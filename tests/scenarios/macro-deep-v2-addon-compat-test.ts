import { appScenarios, baseV2Addon } from './scenarios';
import type { PreparedApp } from 'scenario-tester';
import QUnit from 'qunit';
import merge from 'lodash/merge';

const { module: Qmodule, test } = QUnit;

appScenarios
  .only('canary')
  .map('macro-deep-v2-addon-compat-istesting', project => {
    let addon = baseV2Addon();
    addon.pkg.name = 'macros-consumer-addon';
    // an app-js initializer that re-exports a module which imports undeclared macros
    (addon.pkg as any)['ember-addon']['app-js']['./initializers/macros-consumer.js'] =
      './app/initializers/macros-consumer.js';
    merge(addon.files, {
      app: {
        initializers: {
          'macros-consumer.js': `export { default } from 'macros-consumer-addon/macros-init';`,
        },
      },
      'macros-init.js': `
        import { isTesting } from '@embroider/macros';

        export const isTestingAtModuleLoad = isTesting();

        export default {
          name: 'macros-consumer',
          initialize() {},
        };
      `,
    });

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

    project.addDevDependency(addon);
    project.addDevDependency(intermediate);
    project.linkDevDependency('@embroider/macros', { baseDir: __dirname });

    merge(project.files, {
      tests: {
        unit: {
          'deep-v2-addon-istesting-test.js': `
            import { module, test } from 'qunit';
            import { isTestingAtModuleLoad } from 'intermediate-addon/re-export';

            module('Unit | deep v2 addon | isTesting at module load (compat)', function () {
              test('a second-level v2 addon sees isTesting() === true when evaluated at module load', function (assert) {
                assert.true(
                  isTestingAtModuleLoad,
                  'macros test-support set isTesting before the deep v2 addon module was evaluated'
                );
              });
            });
          `,
          'virtual-peer-istesting-test.js': `
            import { module, test } from 'qunit';
            import { isTestingAtModuleLoad } from 'macros-consumer-addon/macros-init';

            module('Unit | v2 addon app-js | macros virtual peer dep', function () {
              test('an undeclared @embroider/macros import from a v2 addon app-tree resolves and isTesting() is true', function (assert) {
                assert.true(isTestingAtModuleLoad, 'macros rehomed to the app copy + test-support enabled isTesting');
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
