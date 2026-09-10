import { minimalAppScenarios, baseV2Addon } from './scenarios';
import type { PreparedApp } from 'scenario-tester';
import type { Browser } from 'puppeteer-core';
import QUnit from 'qunit';
import merge from 'lodash/merge';
import { setupViteDevServer } from './helpers';
import { launchBrowser } from './helpers/browser';

const { module: Qmodule, test } = QUnit;

minimalAppScenarios
  .only('canary')
  .map('macro-deep-v2-addon-dev-mode', project => {
    let deep = baseV2Addon();
    deep.pkg.name = 'deep-macros-addon';
    merge(deep.files, {
      'is-testing-at-load.js': `
        import { isTesting } from '@embroider/macros';

        // captured once, when this module is first evaluated
        export const isTestingAtModuleLoad = isTesting();

        // a live reading, evaluated whenever it is called
        export function isTestingNow() {
          return isTesting();
        }
      `,
    });

    let intermediate = baseV2Addon();
    intermediate.pkg.name = 'intermediate-addon';
    intermediate.addDependency(deep);
    merge(intermediate.files, {
      're-export.js': `
        export { isTestingAtModuleLoad, isTestingNow } from 'deep-macros-addon/is-testing-at-load';
      `,
    });

    project.addDevDependency(intermediate);
    project.linkDevDependency('@embroider/macros', { baseDir: __dirname });
    project.linkDevDependency('testem', { baseDir: __dirname });
    project.linkDevDependency('@embroider/test-support', { baseDir: __dirname });
    project.linkDevDependency('@ember/test-waiters', { baseDir: __dirname, resolveName: '@ember/test-waiters-4' });

    merge(project.files, {
      'testem-dev.cjs': `
        'use strict';

        module.exports = {
          test_page: 'tests?hidepassed',
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
      'vite.config.mjs': `
        import { defineConfig } from 'vite';
        import { extensions, ember, hbs } from '@embroider/vite';
        import { babel } from '@rollup/plugin-babel';

        export default defineConfig({
          optimizeDeps: {
            exclude: ['@embroider/macros'],
          },
          plugins: [
            hbs(),
            ember(),
            babel({
              babelHelpers: 'runtime',
              extensions,
            }),
          ],
        });
      `,
      src: {
        templates: {
          // Rendered when the app boots normally at '/'. Because the app is not
          // running as tests, isTesting() is false here.
          'application.gjs': `
            import { isTestingAtModuleLoad, isTestingNow } from 'intermediate-addon/re-export';

            const liveIsTesting = () => (isTestingNow() ? 'true' : 'false');
            const atModuleLoad = isTestingAtModuleLoad ? 'true' : 'false';

            <template>
              <div data-test-mode>
                <span data-is-testing>{{liveIsTesting}}</span>
                <span data-is-testing-at-load>{{atModuleLoad}}</span>
              </div>
            </template>
          `,
        },
      },
      tests: {
        'test-helper.js': `
          import Application from '#/app';
          import config, { enterTestMode } from '#config';

          import * as QUnit from 'qunit';
          import { setApplication } from '@ember/test-helpers';
          import { setup } from 'qunit-dom';
          import { start as qunitStart, setupEmberOnerrorValidation } from 'ember-qunit';

          QUnit.config.autostart = false;

          export async function start(loadModules) {
            enterTestMode();
            await loadModules();
            setApplication(Application.create(config.APP));
            setup(QUnit.assert);
            setupEmberOnerrorValidation();
            qunitStart({ loadTests: false });
          }
        `,
        'babel.config.cjs': `
          const { buildMacros } = require('@embroider/macros/babel');

          const macros = buildMacros({
            configure(config) {
              config.enableRuntimeMode();
            },
          });

          module.exports = {
            plugins: [
              [
                'babel-plugin-ember-template-compilation',
                {
                  enableLegacyModules: ['ember-cli-htmlbars'],
                  transforms: [...macros.templateMacros],
                },
              ],
              [
                'module:decorator-transforms',
                {
                  runtime: {
                    import: require.resolve('decorator-transforms/runtime-esm'),
                  },
                },
              ],
              [
                '@babel/plugin-transform-runtime',
                {
                  absoluteRuntime: __dirname,
                  useESModules: true,
                  regenerator: false,
                },
              ],
              ...macros.babelMacros,
            ],

            generatorOpts: {
              compact: false,
            },
          };
        `,
        'index.html': `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8" />
              <title>AppTemplate Tests</title>
            </head>
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
              </script>

              <script type="module">
                import { start } from "./test-helper";

                start(() =>
                  Promise.all(
                    Object.values(import.meta.glob("./**/*.{js,gjs,gts}")).map((m) => m())
                  )
                );
              </script>
            </body>
          </html>
        `,
        unit: {
          'deep-v2-addon-istesting-test.js': `
            import { module, test } from 'qunit';
            import { isTestingNow } from 'intermediate-addon/re-export';

            module('Unit | deep v2 addon | isTesting in test mode', function () {
              test('a second-level v2 addon sees isTesting() === true when running as tests', function (assert) {
                assert.true(isTestingNow(), 'the deep v2 addon resolves the app copy of macros and reads test mode');
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
      let browser: Browser;

      hooks.before(async () => {
        app = await scenario.prepare();
        browser = await launchBrowser();
      });

      hooks.after(async () => {
        await browser?.close();
      });

      let dev = setupViteDevServer(hooks, () => app);

      test('the tests page runs under test mode (isTesting() === true)', async function (assert) {
        let result = await app.execute('pnpm testem --file testem-dev.cjs ci');
        assert.equal(result.exitCode, 0, result.output);
      });

      test('the app page boots without test mode (isTesting() === false)', async function (assert) {
        let page = await browser.newPage();
        try {
          await page.goto(`${dev.appURL}/`, { waitUntil: 'networkidle0' });
          await page.waitForSelector('[data-test-mode] [data-is-testing]', { timeout: 30_000 });
          let info = await page.$eval('[data-test-mode]', el => ({
            isTesting: el.querySelector('[data-is-testing]')?.textContent?.trim(),
            atModuleLoad: el.querySelector('[data-is-testing-at-load]')?.textContent?.trim(),
          }));
          assert.equal(info.isTesting, 'false', 'live isTesting() is false in the running app');
          assert.equal(info.atModuleLoad, 'false', 'isTesting() at module load was false in the running app');
        } finally {
          await page.close();
        }
      });
    });
  });
