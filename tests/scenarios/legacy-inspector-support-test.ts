import { wideAppScenarios } from './scenarios';
import type { PreparedApp, Project, Scenario } from 'scenario-tester';
import QUnit from 'qunit';
import { readdirSync, readFileSync, writeFileSync } from 'fs-extra';
import { join, resolve } from 'path';
import CommandWatcher from './helpers/command-watcher';

const { module: Qmodule, test } = QUnit;

let commonScenario = wideAppScenarios.map('legacy-inspector-support', project => {
  // These are for a custom testem setup that will let us do runtime tests
  // inside `vite dev` rather than only against the output of `vite build`.
  //
  // Most apps should run their CI against `vite build`, as that's closer to
  // production. And they can do development tests directly in brower against
  // `vite dev` at `/tests/index.html`. We're doing `vite dev` in CI here
  // because we're testing the development experience itself.
  project.linkDevDependency('testem', { baseDir: __dirname });
  project.linkDevDependency('@embroider/test-support', { baseDir: __dirname });

  project.linkDevDependency('@embroider/legacy-inspector-support', { baseDir: __dirname });

  project.mergeFiles({
    'testem-dev.js': `
          'use strict';

          module.exports = {
            test_page: '/tests?hidepassed',
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
              require('@embroider/test-support/testem-proxy').testemProxy('http://localhost:4200', '/')
            ],
          };
        `,
    tests: {
      acceptance: {
        'inspector-support-test.js': `
          import { module, test } from 'qunit';
          import { settled, visit } from '@ember/test-helpers';
          import { setupApplicationTest } from 'app-template/tests/helpers';

          module('Acceptance | loading emberInspectorApps', function (hooks) {
            setupApplicationTest(hooks);

            test('visiting /', async function (assert) {
              await visit('/');

              assert.ok(globalThis.emberInspectorApps);
              assert.strictEqual(globalThis.emberInspectorApps.length, 1)
              const modules = await globalThis.emberInspectorApps[0].loadCompatInspector();
              assert.ok(modules);
              assert.ok(modules.Debug.captureRenderTree);
            });
          });
          `,
      },
    },
  });
});

commonScenario
  .skip('lts_3_28-legacy-inspector-support')
  .skip('lts_4_4-legacy-inspector-support')
  .skip('lts_4_8-legacy-inspector-support')
  .map('newer-ember-source', project => addAppJS(project, '@embroider/legacy-inspector-support/ember-source-4.12'))
  .forEachScenario(runTests);

commonScenario
  .only('lts_3_28-legacy-inspector-support')
  .map('older-ember-source', project => addAppJS(project, '@embroider/legacy-inspector-support/ember-source-3.28'))
  .forEachScenario(runTests);

commonScenario
  .only('lts_4_4-legacy-inspector-support')
  .map('older-ember-source', project => addAppJS(project, '@embroider/legacy-inspector-support/ember-source-3.28'))
  .forEachScenario(runTests);

commonScenario
  .only('lts_4_8-legacy-inspector-support')
  .map('older-ember-source', project => addAppJS(project, '@embroider/legacy-inspector-support/ember-source-4.8'))
  .forEachScenario(runTests);

function addAppJS(project: Project, inspectorPath: string) {
  project.mergeFiles({
    app: {
      'app.js': `
        import Application from '@ember/application';
        import compatModules from '@embroider/virtual/compat-modules';
        import Resolver from 'ember-resolver';
        import loadInitializers from 'ember-load-initializers';
        import config from './config/environment';

        import setupInspector from '${inspectorPath}';

        export default class App extends Application {
          modulePrefix = config.modulePrefix;
          podModulePrefix = config.podModulePrefix;
          Resolver = Resolver.withModules(compatModules);
          inspector = setupInspector(this);
        }

        loadInitializers(App, config.modulePrefix, compatModules);
        `,
    },
  });
}

function runTests(scenario: Scenario) {
  Qmodule(scenario.name, function (hooks) {
    let app: PreparedApp;

    hooks.before(async () => {
      app = await scenario.prepare();
    });

    test(`pnpm test:ember`, async function (assert) {
      // this will only hang if there is an issue
      assert.timeout(5 * 60 * 1000);
      let result = await app.execute('pnpm test:ember');
      assert.equal(result.exitCode, 0, result.output);
      console.log(result.output);
      assert.ok(
        result.output.includes('loading emberInspectorApps'),
        'The output of qunit shows we ran the loading emberInspectorApps test file'
      );
    });

    test(`pnpm build`, async function (assert) {
      let result = await app.execute('pnpm build');
      assert.equal(result.exitCode, 0, result.output);
      const distFiles = readdirSync(join(app.dir, 'dist'));
      assert.ok(distFiles.length > 1, 'should have created dist folder');
      assert.ok(distFiles.includes('assets'), 'should have created assets folder');
      assert.ok(distFiles.includes('robots.txt'), 'should have copied app assets');

      const assetFiles = readdirSync(join(app.dir, 'dist', '@embroider', 'virtual'));
      assert.ok(assetFiles.length > 1, 'should have created asset files');
    });

    Qmodule('vite dev', function (hooks) {
      let server: CommandWatcher;

      hooks.before(async () => {
        server = CommandWatcher.launch('vite', ['--clearScreen', 'false'], { cwd: app.dir });
        const [, appURL] = await server.waitFor(/Local:\s+(https?:\/\/.*)\//g);

        let testem = readFileSync(resolve(app.dir, 'testem-dev.js')).toString();
        testem = testem.replace(`.testemProxy('http://localhost:4200', '/')`, `.testemProxy('${appURL}', '/')`);
        writeFileSync(resolve(app.dir, 'testem-dev.js'), testem);
      });

      hooks.after(async () => {
        await server?.shutdown();
      });

      test('run test suite against vite dev', async function (assert) {
        let result = await app.execute('pnpm testem --file testem-dev.js ci');
        assert.equal(result.exitCode, 0, result.output);
      });
    });
  });
}
