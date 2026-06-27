import { minimalAppScenarios, baseV2Addon } from './scenarios';
import type { PreparedApp } from 'scenario-tester';
import QUnit from 'qunit';
import merge from 'lodash/merge';

const { module: Qmodule, test } = QUnit;

minimalAppScenarios
  .only('canary')
  .map('macro-deep-v2-addon-istesting', project => {
    let deep = baseV2Addon();
    deep.pkg.name = 'deep-macros-addon';
    merge(deep.files, {
      'is-testing-at-load.js': `
        import { isTesting } from '@embroider/macros';

        export const isTestingAtModuleLoad = isTesting();
      `,
    });

    let intermediate = baseV2Addon();
    intermediate.pkg.name = 'intermediate-addon';
    intermediate.addDependency(deep);
    merge(intermediate.files, {
      're-export.js': `
        export { isTestingAtModuleLoad } from 'deep-macros-addon/is-testing-at-load';
      `,
    });

    project.addDevDependency(intermediate);
    project.linkDevDependency('@embroider/macros', { baseDir: __dirname });

    merge(project.files, {
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
            import { isTestingAtModuleLoad } from 'intermediate-addon/re-export';

            module('Unit | deep v2 addon | isTesting at module load', function () {
              test('a second-level v2 addon sees isTesting() === true when evaluated at module load', function (assert) {
                assert.true(
                  isTestingAtModuleLoad,
                  'macros test-support set isTesting before the deep v2 addon module was evaluated'
                );
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

      test('pnpm test', async function (assert) {
        let result = await app.execute('pnpm test');
        assert.equal(result.exitCode, 0, result.output);
      });
    });
  });
