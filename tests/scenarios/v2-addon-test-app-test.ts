import { minimalAppScenarios } from './scenarios';
import type { PreparedApp } from 'scenario-tester';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import QUnit from 'qunit';

const { module: Qmodule, test } = QUnit;

/**
 * A v2 addon in the package shape of @ember/addon-blueprint, with its test app in `demo-app/`.
 * `appDir` points Embroider at that folder, because package.json `exports` points at `dist/`.
 * The test app gets its modules, and the app-js of its addons, from compat-modules,
 * and uses the strict resolver of Ember 7.2+.
 */
minimalAppScenarios
  .only('canary')
  .map('v2-addon-test-app-compat-modules', project => {
    /**
     * compat-modules includes the app-js of every active addon.
     * The app-js of ember-data needs an ember-cli-build file.
     */
    project.removeDevDependency('ember-data');
    project.linkDevDependency('@embroider/addon-shim', { baseDir: __dirname });

    project.name = 'v2-addon-with-app';
    project.pkg.keywords = ['ember-addon'];
    project.pkg['ember-addon'] = { version: 2, type: 'addon', main: 'addon-main.cjs' };
    project.pkg.imports = {
      '#src/*': './src/*',
      '#demo-app/*': './demo-app/*',
      '#config': './demo-app/config.js',
    };
    project.pkg.exports = {
      '.': './dist/index.js',
      './addon-main.js': './addon-main.cjs',
      './*.css': './dist/*.css',
      './*': './dist/*.js',
    };

    let src = project.files.src as Record<string, unknown>;
    let config = src['config.js'];

    project.mergeFiles({
      'embroider.config.js': `export default { appDir: './demo-app' };`,
      'addon-main.cjs': `module.exports = require('@embroider/addon-shim').addonV1Shim(__dirname);`,
      'index.html': `
        <!DOCTYPE html>
        <html>
          <body>
            <script type="module">
              import Application from "./demo-app/app";
              import environment from "./demo-app/config";

              Application.create(environment.APP);
            </script>
          </body>
        </html>
      `,
      src: {
        'app.js': null,
        'config.js': null,
        'registry.js': null,
        'router.js': null,
        styles: null,
        templates: null,
        components: {
          'greeting.gjs': `<template><p data-test-greeting>Hello from the addon</p></template>`,
        },
      },
      'demo-app': {
        'config.js': config as string,
        'app.js': `
          import Application from '@ember/application';
          import compatModules from '@embroider/virtual/compat-modules';

          export default class App extends Application {
            modules = compatModules;
          }
        `,
        'router.js': `
          import EmberRouter from '@ember/routing/router';
          import config from '#config';

          export default class Router extends EmberRouter {
            location = config.locationType;
            rootURL = config.rootURL;
          }

          Router.map(function () {
            this.route('about');
          });
        `,
        routes: {
          'about.js': `
            import Route from '@ember/routing/route';
            export default class AboutRoute extends Route {}
          `,
        },
        templates: {
          'application.gjs': `
            import Greeting from '#src/components/greeting.gjs';
            import { pageTitle } from 'ember-page-title';
            <template>{{pageTitle "Demo App"}}<Greeting />{{outlet}}</template>
          `,
          'about.gjs': `<template><div data-test-about>This is the about route.</div></template>`,
        },
      },
      tests: {
        'index.html': `
          <!DOCTYPE html>
          <html>
            <body>
              <div id="qunit"></div>
              <div id="qunit-fixture">
                <div id="ember-testing-container">
                  <div id="ember-testing"></div>
                </div>
              </div>

              <script src="/testem.js" integrity="" data-embroider-ignore></script>
              <script type="module">
                import "ember-testing";
                globalThis.EmberENV = {};
              </script>

              <script type="module">
                import { start } from "./test-helper";
                import.meta.glob("./**/*.{js,gjs,gts}", { eager: true });
                start();
              </script>
            </body>
          </html>
        `,
        'test-helper.js': `
          import Application from '#demo-app/app.js';
          import config, { enterTestMode } from '#config';
          import * as QUnit from 'qunit';
          import { setApplication } from '@ember/test-helpers';
          import { setup } from 'qunit-dom';
          import { start as qunitStart, setupEmberOnerrorValidation } from 'ember-qunit';

          export function start() {
            enterTestMode();
            setApplication(Application.create(config.APP));
            setup(QUnit.assert);
            setupEmberOnerrorValidation();
            qunitStart();
          }
        `,
        acceptance: {
          'compat-modules-test.js': `
            import { module, test } from 'qunit';
            import { visit } from '@ember/test-helpers';
            import { setupApplicationTest } from 'ember-qunit';

            module('Acceptance | compat-modules in a v2 addon test app', function (hooks) {
              setupApplicationTest(hooks);

              test('the test app resolves its own modules', async function (assert) {
                await visit('/about');
                assert.dom('[data-test-about]').exists();
                assert.dom('[data-test-greeting]').hasText('Hello from the addon');

                let resolver = this.owner.lookup('resolver:current');
                assert.ok(resolver.resolve('route:about'), 'route:about');
                assert.ok(resolver.resolve('template:about'), 'template:about');
                assert.ok(resolver.resolve('service:page-title'), 'the app-js of ember-page-title');
              });
            });
          `,
        },
      },
    });
  })
  .forEachScenario(scenario => {
    Qmodule(scenario.name, function (hooks) {
      let app: PreparedApp;
      hooks.before(async () => {
        app = await scenario.prepare();
      });

      test(`compat-modules uses "./" module names`, async function (assert) {
        let result = await app.execute('pnpm cross-env NODE_ENV=development vite build --mode development');
        assert.equal(result.exitCode, 0, result.output);

        let assetsDir = join(app.dir, 'dist', 'assets');
        let sources = readdirSync(assetsDir)
          .filter(name => name.endsWith('.js'))
          .map(name => readFileSync(join(assetsDir, name), 'utf8'))
          .join('\n');
        assert.true(sources.includes('"./routes/about"'), 'routes/about');
        assert.true(sources.includes('"./templates/about"'), 'templates/about');
        assert.true(sources.includes('"./services/page-title"'), 'the app-js of ember-page-title');
        assert.false(sources.includes('"v2-addon-with-app/routes/about"'), 'no package name prefix');
      });

      test(`the test app runs`, async function (assert) {
        let result = await app.execute('pnpm dist:ember:test');
        assert.equal(result.exitCode, 0, result.output);
      });
    });
  });
