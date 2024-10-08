import { appScenarios } from './scenarios';
import type { PreparedApp } from 'scenario-tester';
import QUnit from 'qunit';
import fs from 'fs/promises';
import { pathExists } from 'fs-extra';
import path from 'path';
import CommandWatcher from './helpers/command-watcher';
import puppeteer, { type Browser, type Page } from 'puppeteer';
import { setupAuditTest } from '@embroider/test-support/audit-assertions';

const { module: Qmodule, test } = QUnit;

let app = appScenarios.map('watch-mode', app => {
  app.mergeFiles({
    'testem-dev.js': `
        'use strict';

        module.exports = {
          test_page: 'tests/index.html?hidepassed',
          disable_watching: true,
          launch_in_ci: ['Chrome'],
          launch_in_dev: ['Chrome'],
          browser_start_timeout: 120,
          browser_args: {
            Chrome: {
              ci: [
                // --no-sandbox is needed when running Chrome inside a container
                process.env.CI ? '--no-sandbox' : null,
                '--headless',
                '--disable-dev-shm-usage',
                '--disable-software-rasterizer',
                '--mute-audio',
                '--remote-debugging-port=0',
                '--window-size=1440,900',
              ].filter(Boolean),
            },
          },
          middleware: [
            require('@embroider/test-support/testem-proxy').testemProxy('http://localhost:4200')
          ],
        };
      `,
    'ember-cli-build.js': `'use strict';

const EmberApp = require('ember-cli/lib/broccoli/ember-app');
const { maybeEmbroider } = require('@embroider/test-setup');

module.exports = function (defaults) {
  let app = new EmberApp(defaults, {});

  return maybeEmbroider(app, {
    // we need this to simplify adding componnets and having them added to the entrypoint
    staticComponents: false,
  });
};
`,
  });
  /**
   * We will create app files as a part of the watch-mode tests,
   * because creating files should cause appropriate watch/update behavior
   */
});

class File {
  constructor(readonly label: string, readonly fullPath: string) {}

  async exists(): Promise<boolean> {
    return pathExists(this.fullPath);
  }

  async read(): Promise<string | null> {
    try {
      return await fs.readFile(this.fullPath, { encoding: 'utf-8' });
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null;
      } else {
        throw error;
      }
    }
  }

  async write(content: string): Promise<void> {
    await fs.writeFile(this.fullPath, content, { encoding: 'utf-8' });
  }

  async delete(): Promise<void> {
    await fs.unlink(this.fullPath);
  }
}

app.forEachScenario(scenario => {
  Qmodule(scenario.name, function (hooks) {
    let app: PreparedApp;
    let server: CommandWatcher;
    let appURL: string;
    let browser: Browser;
    let appPage: Page;
    let testsPage: Page;

    function appFile(appPath: string): File {
      let fullPath = path.join(app.dir, ...appPath.split('/'));
      return new File(appPath, fullPath);
    }

    async function waitFor(...args: Parameters<CommandWatcher['waitFor']>): Promise<void> {
      await server.waitFor(...args);
    }

    async function added(): Promise<void> {
      await waitFor(new RegExp(`page reload embroider_virtual:.*/app/-embroider-entrypoint.js`));
    }

    async function changed(filePath: string): Promise<void> {
      await waitFor(new RegExp(`.*page reload ${path.join(...filePath.split('/'))}`));
    }

    async function deleted(filePath: string): Promise<void> {
      await waitFor(new RegExp(`.*page reload ${path.join(...filePath.split('/'))}`));
    }

    hooks.before(async () => {
      app = await scenario.prepare();
      server = CommandWatcher.launch('vite', ['--clearScreen', 'false'], { cwd: app.dir });
      [, appURL] = await server.waitFor(/Local:\s+(https?:\/\/.*)\//g);

      // it's annoying but we need to have an open browser to truly test file reload functionality
      browser = await puppeteer.launch();
      appPage = await browser.newPage();
      await appPage.goto(appURL);

      // we also need to go to the tests page to watch for additions to test files
      testsPage = await browser.newPage();
      await testsPage.goto(appURL + '/tests/');
    });

    let expectAudit = setupAuditTest(hooks, () => ({
      appURL,
      startingFrom: ['index.html'],
      fetch: fetch as unknown as typeof globalThis.fetch,
    }));

    hooks.after(async () => {
      await Promise.all([server.shutdown(), browser.close()]);
    });

    test(`adding a simple file`, async function (assert) {
      expectAudit.module(/.*app\/-embroider-entrypoint.js/).doesNotIncludeContent('app/simple-file.js');

      const originalContent =
        'TWO IS A GREAT NUMBER< I LKE IT A LOT< IT IS THE POWER OF ALL  OF ELECTRONICS, MATH, ETC';
      // assert.false(await checkScripts(/js$/, originalContent), 'file has not been created yet');

      await appFile('app/simple-file.js').write(`export const two = "${originalContent}";`);
      await added();

      await expectAudit.rerun();

      expectAudit.module(/.*app\/-embroider-entrypoint.js/).withContents(contents => {
        assert.ok(contents.includes('app/simple-file.js'), 'simple-file is in the entrypoint after we add the file');
        return true;
      });

      expectAudit.module('./app/simple-file.js').codeContains(`export const two = "${originalContent}";`);
      const updatedContent = 'THREE IS A GREAT NUMBER TWO';

      await appFile('app/simple-file.js').write(`export const two = "${updatedContent}";`);
      await changed('app/simple-file.js');

      await expectAudit.rerun();

      expectAudit.module('./app/simple-file.js').codeContains(`export const two = "${updatedContent}";`);
    });

    Qmodule('[GH#1619] co-located components regressions', function () {
      test('Scenario 1: deleting a template-only component', async function () {
        expectAudit
          .module(/.*app\/-embroider-entrypoint.js/)
          .doesNotIncludeContent('"app-template/components/hello-world"');

        await appFile('app/components/hello-world.hbs').write('hello world!');
        await added();
        await expectAudit.rerun();

        expectAudit.module(/.*app\/-embroider-entrypoint.js/).includesContent('"app-template/components/hello-world"');
        expectAudit.module('./app/components/hello-world.hbs').includesContent('hello world!');
        expectAudit.module('./app/components/hello-world.js').codeContains(`
          export default setComponentTemplate(TEMPLATE, templateOnly());
        `);

        await appFile('app/components/hello-world.hbs').delete();
        await deleted('app/components/hello-world.hbs');

        await expectAudit.rerun();

        expectAudit
          .module(/.*app\/-embroider-entrypoint.js/)
          .doesNotIncludeContent('"app-template/components/hello-world"');
      });

      test('Scenario 2: adding a template to a component', async function (assert) {
        await expectAudit.rerun();
        expectAudit
          .module(/.*app\/-embroider-entrypoint.js/)
          .doesNotIncludeContent('"app-template/components/hello-world"');

        await appFile('tests/integration/hello-world-test.js').write(`
          import { module, test } from 'qunit';
          import { setupRenderingTest } from 'ember-qunit';
          import { render } from '@ember/test-helpers';
          import { hbs } from 'ember-cli-htmlbars';

          module('Integration | hello-world', function(hooks) {
            setupRenderingTest(hooks);

            test('it renders', async function(assert) {
              await render(hbs\`<HelloWorld />\`);
              assert.dom(this.element).hasText('hello world!');
            });
          });
        `);
        await changed('tests/integration/hello-world-test.js');

        await appFile('app/components/hello-world.js').write(`
          import Component from '@glimmer/component';
          export default class extends Component {}
        `);
        await added();

        await expectAudit.rerun();
        expectAudit.module('./app/components/hello-world.js').codeContains(`
          export default class extends Component {}
        `);

        let result = await app.execute('pnpm testem --file testem-dev.js ci');
        assert.equal(result.exitCode, 1, result.output);
        assert.ok(/^not ok .+ Integration | hello-world: it renders/.test(result.output), result.output);

        await appFile('app/components/hello-world.hbs').write('hello world!');
        await added();

        await expectAudit.rerun();

        expectAudit.module('./app/components/hello-world.hbs').includesContent('hello world!');

        // TODO this seems to be failling I assume because the js file isn't being updated
        expectAudit.module('./app/components/hello-world.js').codeContains(`
          export default setComponentTemplate(TEMPLATE, templateOnly());
        `);

        result = await app.execute('pnpm testem --file testem-dev.js ci');
        assert.equal(result.exitCode, 0, result.output);
        assert.ok(/^ok .+ Integration | hello-world: it renders/.test(result.output), result.output);
      });

      test('Scenario 3: deleting a co-located template', async function () {
        await expectAudit.rerun();
        expectAudit
          .module(/.*app\/-embroider-entrypoint.js/)
          .doesNotIncludeContent('"app-template/components/hello-world"');

        await appFile('app/components/hello-world.hbs').write('hello world!');
        await added();

        await expectAudit.rerun();

        expectAudit.module(/.*app\/-embroider-entrypoint.js/).includesContent('"app-template/components/hello-world"');

        expectAudit.module('./app/components/hello-world.hbs').includesContent('hello world!');
        expectAudit.module('./app/components/hello-world.js').codeContains(`
          export default setComponentTemplate(TEMPLATE, templateOnly());
        `);

        await appFile('app/components/hello-world.js').write(`
          import Component from '@glimmer/component';
          export default class extends Component {}
        `);
        await added();
        await expectAudit.rerun();
        expectAudit.module('./app/components/hello-world.hbs').includesContent('hello world!');
        expectAudit
          .module('./app/components/hello-world.js')
          .codeContains(`import TEMPLATE from "/app/components/hello-world.hbs?import";`);
        expectAudit
          .module('./app/components/hello-world.js')
          .codeContains(`export default setComponentTemplate(TEMPLATE, class extends Component {});`);

        await appFile('app/components/hello-world.hbs').delete();
        await deleted('app/components/hello-world.hbs');
        await expectAudit.rerun();

        expectAudit.module('./app/components/hello-world.js').codeContains(`
          export default class extends Component {}
        `);
      });

      test('Scenario 4: editing a co-located js file', async function () {
        await expectAudit.rerun();
        expectAudit
          .module(/.*app\/-embroider-entrypoint.js/)
          .doesNotIncludeContent('"app-template/components/hello-world"');

        await appFile('app/components/hello-world.hbs').write('hello world!');
        await added();

        await appFile('app/components/hello-world.js').write(`
          import Component from '@glimmer/component';
          export default class extends Component {}
        `);
        await added();
        await expectAudit.rerun();

        expectAudit.module('./app/components/hello-world.hbs').includesContent('hello world!');
        expectAudit
          .module('./app/components/hello-world.js')
          .codeContains(`import TEMPLATE from "/app/components/hello-world.hbs?import";`);
        expectAudit
          .module('./app/components/hello-world.js')
          .codeContains(`export default setComponentTemplate(TEMPLATE, class extends Component {});`);

        await appFile('app/components/hello-world.js').write(`
          import Component from '@glimmer/component';
          export default class extends Component {
            // this shows that updates invalidate any caches and reflects properly
          }
        `);
        await changed('app/components/hello-world.js');
        await expectAudit.rerun();

        expectAudit.module('./app/components/hello-world.hbs').includesContent('hello world!');
        expectAudit.module(
          './app/components/hello-world.js'
        ).codeContains(`export default setComponentTemplate(TEMPLATE, class extends Component {
      // this shows that updates invalidate any caches and reflects properly
    });`);
      });
    });
  });
});
