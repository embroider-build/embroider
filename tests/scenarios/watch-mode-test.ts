import { appScenarios } from './scenarios';
import type { PreparedApp } from 'scenario-tester';
import QUnit from 'qunit';
import fs from 'fs/promises';
import { pathExists } from 'fs-extra';
import path from 'path';
import CommandWatcher, { DEFAULT_TIMEOUT } from './helpers/command-watcher';
import puppeteer, { type Browser, type Page } from 'puppeteer';
import { setupAuditTest } from '@embroider/test-support/audit-assertions';

const { module: Qmodule, test } = QUnit;

let app = appScenarios.map('watch-mode', () => {
  /**
   * We will create files as a part of the watch-mode tests,
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

class AssertFile {
  readonly file: File;

  constructor(private assert: Assert, file: File) {
    this.file = file;
  }

  async exists(): Promise<void> {
    this.assert.true(await this.file.exists(), `${this.file.label} exists`);
  }

  async doesNotExist(): Promise<void> {
    this.assert.false(await this.file.exists(), `${this.file.label} does not exists`);
  }

  async hasContent(expected: string): Promise<void> {
    let actual = await this.file.read();

    if (actual === null) {
      this.assert.ok(false, `${this.file.label} does not exists`);
    } else {
      this.assert.equal(actual, expected, `content of ${this.file.label}`);
    }
  }

  async doesNotHaveContent(expected: string | RegExp): Promise<void> {
    let actual = await this.file.read();

    if (actual === null) {
      this.assert.ok(false, `${this.file.label} does not exists`);
    } else {
      this.assert.notEqual(actual, expected, `content of ${this.file.label}`);
    }
  }

  async includesContent(expected: string): Promise<void> {
    let actual = await this.file.read();

    if (actual === null) {
      this.assert.ok(false, `${this.file.label} does not exists`);
    } else {
      this.assert.true(actual.includes(expected), `content of ${this.file.label}`);
    }
  }

  async doesNotIncludeContent(expected: string): Promise<void> {
    let actual = await this.file.read();

    if (actual === null) {
      this.assert.ok(false, `${this.file.label} does not exists`);
    } else {
      this.assert.false(actual.includes(expected), `content of ${this.file.label}`);
    }
  }
}

function d(strings: TemplateStringsArray, ...values: unknown[]): string {
  let buf = '';
  for (let string of strings) {
    if (values.length) {
      buf += string + values.shift();
    } else {
      buf += string;
    }
  }
  return deindent(buf);
}

function deindent(s: string): string {
  if (s.startsWith('\n')) {
    s = s.slice(1);
  }

  let indentSize = s.search(/\S/);

  if (indentSize > 0) {
    let indent = s.slice(0, indentSize);

    s = s
      .split('\n')
      .map(line => {
        if (line.startsWith(indent)) {
          return line.slice(indentSize);
        } else {
          return line;
        }
      })
      .join('\n');
  }

  s = s.trimEnd();

  return s;
}

app.forEachScenario(scenario => {
  Qmodule(scenario.name, function (hooks) {
    let app: PreparedApp;
    let server: CommandWatcher;
    let appURL: string;
    let browser: Browser;
    let page: Page;

    function appFile(appPath: string): File {
      let fullPath = path.join(app.dir, ...appPath.split('/'));
      return new File(appPath, fullPath);
    }

    async function waitFor(...args: Parameters<CommandWatcher['waitFor']>): Promise<void> {
      await server.waitFor(...args);
    }

    async function added(_filePath: string): Promise<void> {
      await waitFor(new RegExp(`page reload embroider_virtual:.*/app/-embroider-entrypoint.js`));
    }

    async function changed(filePath: string): Promise<void> {
      await waitFor(`page reload ${path.join(...filePath.split('/'))}`);
    }

    async function deleted(filePath: string): Promise<void> {
      await waitFor(`page reload ${path.join(...filePath.split('/'))}`);
    }

    hooks.before(async () => {
      app = await scenario.prepare();
      server = CommandWatcher.launch('vite', ['--clearScreen', 'false'], { cwd: app.dir });
      [, appURL] = await server.waitFor(/Local:\s+(https?:\/\/.*)\//g);

      // it's annoying but we need to have an open browser to truly test file reload functionality
      browser = await puppeteer.launch();
      page = await browser.newPage();
      await page.goto(appURL);
    });

    let expectAudit = setupAuditTest(hooks, () => ({
      appURL,
      startingFrom: ['index.html'],
      fetch: fetch as unknown as typeof globalThis.fetch,
    }));

    hooks.afterEach(async () => {
      await Promise.all([server.shutdown(), browser.close()]);
    });

    test(`adding a simple file`, async function (assert) {
      expectAudit.module(/.*app\/-embroider-entrypoint.js/).withContents(contents => {
        assert.ok(
          !contents.includes('app/simple-file.js'),
          'simple-file is not in the entrypoint before we add the file'
        );
        return true;
      });

      const originalContent =
        'TWO IS A GREAT NUMBER< I LKE IT A LOT< IT IS THE POWER OF ALL  OF ELECTRONICS, MATH, ETC';
      // assert.false(await checkScripts(/js$/, originalContent), 'file has not been created yet');

      await appFile('app/simple-file.js').write(`export const two = "${originalContent}";`);
      await added('app/simple-file.js');

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

    Qmodule('[GH#1619] co-located components regressions', function (hooks) {
      // These tests uses the internal `.rewritten-app` structure to confirm the failures.
      // If that changes these tests should be updated to match the spirit of the original
      // issue (https://github.com/embroider-build/embroider/issues/1619)
      let assertRewrittenFile: (rewrittenPath: string) => AssertFile;

      hooks.beforeEach(assert => {
        assertRewrittenFile = (rewrittenPath: string) => {
          let fullPath = path.join(app.dir, 'tmp', 'rewritten-app', ...rewrittenPath.split('/'));
          let file = new File(rewrittenPath, fullPath);
          return new AssertFile(assert, file);
        };
      });

      test('Scenario 1: deleting a template-only component', async function () {
        await assertRewrittenFile('assets/app-template.js').doesNotIncludeContent(
          '"app-template/components/hello-world"'
        );
        await assertRewrittenFile('components/hello-world.hbs').doesNotExist();
        await assertRewrittenFile('components/hello-world.js').doesNotExist();

        await appFile('app/components/hello-world.hbs').write('hello world!');
        await added('components/hello-world.hbs');
        await waitFor(/Build successful/);
        await assertRewrittenFile('assets/app-template.js').includesContent('"app-template/components/hello-world"');
        await assertRewrittenFile('components/hello-world.hbs').hasContent('hello world!');
        await assertRewrittenFile('components/hello-world.js').hasContent(d`
          /* import __COLOCATED_TEMPLATE__ from './hello-world.hbs'; */
          import templateOnlyComponent from '@ember/component/template-only';
          export default templateOnlyComponent();
        `);

        await appFile('app/components/hello-world.hbs').delete();
        await deleted('components/hello-world.hbs');
        await waitFor(/Build successful/);
        await assertRewrittenFile('assets/app-template.js').doesNotIncludeContent(
          '"app-template/components/hello-world"'
        );
        await assertRewrittenFile('components/hello-world.hbs').doesNotExist();
        await assertRewrittenFile('components/hello-world.js').doesNotExist();
      });

      test('Scenario 2: adding a template to a component', async function (assert) {
        await assertRewrittenFile('components/hello-world.hbs').doesNotExist();
        await assertRewrittenFile('components/hello-world.js').doesNotExist();
        await assertRewrittenFile('tests/integration/hello-world-test.js').doesNotExist();

        await appFile('tests/integration/hello-world-test.js').write(d`
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
        await added('integration/hello-world-test.js');
        await waitFor(/Build successful/);
        await assertRewrittenFile('components/hello-world.hbs').doesNotExist();
        await assertRewrittenFile('components/hello-world.js').doesNotExist();
        await assertRewrittenFile('tests/integration/hello-world-test.js').includesContent('<HelloWorld />');

        await appFile('app/components/hello-world.js').write(d`
          import Component from '@glimmer/component';
          export default class extends Component {}
        `);
        await added('components/hello-world.js');
        await waitFor(/Build successful/);
        await assertRewrittenFile('components/hello-world.hbs').doesNotExist();
        await assertRewrittenFile('components/hello-world.js').hasContent(d`
          import Component from '@glimmer/component';
          export default class extends Component {}
        `);
        await assertRewrittenFile('tests/integration/hello-world-test.js').includesContent('<HelloWorld />');

        let test = await CommandWatcher.launch('ember', ['test', '--filter', 'hello-world'], { cwd: app.dir });
        await test.waitFor(/^not ok .+ Integration | hello-world: it renders/, DEFAULT_TIMEOUT * 2);
        await assert.notStrictEqual(await test.waitForExit(), 0);

        await appFile('app/components/hello-world.hbs').write('hello world!');
        await added('components/hello-world.hbs');
        await waitFor(/Build successful/);
        await assertRewrittenFile('components/hello-world.hbs').hasContent('hello world!');
        await assertRewrittenFile('components/hello-world.js').hasContent(d`
          /* import __COLOCATED_TEMPLATE__ from './hello-world.hbs'; */
          import Component from '@glimmer/component';
          export default class extends Component {}
        `);
        await assertRewrittenFile('tests/integration/hello-world-test.js').includesContent('<HelloWorld />');

        test = await CommandWatcher.launch('ember', ['test', '--filter', 'hello-world'], { cwd: app.dir });
        await test.waitFor(/^ok .+ Integration | hello-world: it renders/);
        await assert.strictEqual(await test.waitForExit(), 0);
      });

      test('Scenario 3: deleting a co-located template', async function () {
        await assertRewrittenFile('components/hello-world.hbs').doesNotExist();
        await assertRewrittenFile('components/hello-world.js').doesNotExist();

        await appFile('app/components/hello-world.hbs').write('hello world!');
        await added('components/hello-world.hbs');
        await waitFor(/Build successful/);
        await assertRewrittenFile('components/hello-world.hbs').hasContent('hello world!');
        await assertRewrittenFile('components/hello-world.js').hasContent(d`
          /* import __COLOCATED_TEMPLATE__ from './hello-world.hbs'; */
          import templateOnlyComponent from '@ember/component/template-only';
          export default templateOnlyComponent();
        `);

        await appFile('app/components/hello-world.js').write(d`
          import Component from '@glimmer/component';
          export default class extends Component {}
        `);
        await added('components/hello-world.js');
        await waitFor(/Build successful/);
        await assertRewrittenFile('components/hello-world.hbs').hasContent('hello world!');
        await assertRewrittenFile('components/hello-world.js').hasContent(d`
          /* import __COLOCATED_TEMPLATE__ from './hello-world.hbs'; */
          import Component from '@glimmer/component';
          export default class extends Component {}
        `);

        await appFile('app/components/hello-world.hbs').delete();
        await deleted('components/hello-world.hbs');
        await waitFor(/Build successful/);
        await assertRewrittenFile('components/hello-world.hbs').doesNotExist();
        await assertRewrittenFile('components/hello-world.js').hasContent(d`
          import Component from '@glimmer/component';
          export default class extends Component {}
        `);
      });

      test('Scenario 4: editing a co-located js file', async function () {
        await assertRewrittenFile('components/hello-world.hbs').doesNotExist();
        await assertRewrittenFile('components/hello-world.js').doesNotExist();

        await appFile('app/components/hello-world.hbs').write('hello world!');
        await added('components/hello-world.hbs');
        await waitFor(/Build successful/);

        await appFile('app/components/hello-world.js').write(d`
          import Component from '@glimmer/component';
          export default class extends Component {}
        `);
        await added('components/hello-world.js');
        await waitFor(/Build successful/);

        await assertRewrittenFile('components/hello-world.hbs').hasContent('hello world!');
        await assertRewrittenFile('components/hello-world.js').hasContent(d`
          /* import __COLOCATED_TEMPLATE__ from './hello-world.hbs'; */
          import Component from '@glimmer/component';
          export default class extends Component {}
        `);

        await appFile('app/components/hello-world.js').write(d`
          import Component from '@glimmer/component';
          export default class extends Component {
            // this shows that updates invalidate any caches and reflects properly
          }
        `);
        await changed('components/hello-world.js');
        await waitFor(/Build successful/);

        await assertRewrittenFile('components/hello-world.hbs').hasContent('hello world!');
        await assertRewrittenFile('components/hello-world.js').hasContent(d`
          /* import __COLOCATED_TEMPLATE__ from './hello-world.hbs'; */
          import Component from '@glimmer/component';
          export default class extends Component {
            // this shows that updates invalidate any caches and reflects properly
          }
        `);
      });
    });
  });
});
