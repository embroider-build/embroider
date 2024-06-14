import type { PreparedApp } from 'scenario-tester';
import { appScenarios, baseAddon, renameApp } from './scenarios';
import QUnit from 'qunit';
const { module: Qmodule, test } = QUnit;
import { throwOnWarnings } from '@embroider/core';

appScenarios
  .map('compat-namespaced-app', app => {
    renameApp(app, '@ef4/namespaced-app');

    app.mergeFiles({
      app: {
        styles: {
          'app.css': `body { background-color: blue }`,
        },
      },
      tests: {
        acceptance: {
          'smoke-test.js': `
            import { module, test } from 'qunit';
            import { visit } from '@ember/test-helpers';
            import { setupApplicationTest } from 'ember-qunit';

            module('Acceptance | smoke-test', function(hooks) {
              setupApplicationTest(hooks);

              test('styles present', async function(assert) {
                await visit('/');
                assert.strictEqual(getComputedStyle(document.querySelector('body'))['background-color'], 'rgb(0, 0, 255)');
              });

              test('addon implicit modules worked', async function(assert) {
                assert.strictEqual(globalThis.addonImplicitModulesWorked, true, 'checking for globalThis.addonImplicitModulesWorked');
              })
            });
          `,
        },
      },
    });

    let addon = baseAddon();
    addon.pkg.name = 'my-addon';
    addon.pkg['ember-addon'] = {
      version: 2,
      type: 'addon',
      'implicit-modules': ['./my-implicit-module.js'],
    };
    addon.files['my-implicit-module.js'] = `
      globalThis.addonImplicitModulesWorked = true;
      export default {};
    `;
    app.addDevDependency(addon);
  })
  .forEachScenario(function (scenario) {
    Qmodule(scenario.name, function (hooks) {
      throwOnWarnings(hooks);

      let app: PreparedApp;

      hooks.before(async () => {
        app = await scenario.prepare();
      });

      test(`pnpm test`, async assert => {
        let result = await app.execute('pnpm test');
        assert.equal(result.exitCode, 0, result.output);
      });
    });
  });
