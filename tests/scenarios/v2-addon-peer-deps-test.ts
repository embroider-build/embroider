import { appScenarios, baseV2Addon, baseAddon } from './scenarios';
import { PreparedApp } from 'scenario-tester';
import QUnit from 'qunit';
import merge from 'lodash/merge';

const { module: Qmodule, test } = QUnit;

appScenarios
  .map('v2-addon-with-optional-peer-dep-on-v1-addon', project => {
    let v1Addon = baseAddon();

    v1Addon.pkg.name = 'v1-addon';
    merge(v1Addon.files, {
      addon: {
        'index.js': `export class TrackedAsyncData {}`,
      },
    });

    let v2Addon = baseV2Addon();

    merge(v2Addon.files, {
      'index.js': `export { TrackedAsyncData } from 'v1-addon';`,
    });

    v2Addon.pkg.name = 'v2-addon';
    v2Addon.pkg.peerDependencies = {
      'v1-addon': v1Addon.version,
    };
    v2Addon.pkg.peerDependenciesMeta = {
      'v1-addon': {
        optional: true,
      },
    };

    project.addDependency(v2Addon);
    project.addDependency(v1Addon);

    merge(project.files, {
      tests: {
        unit: {
          'import-test.js': `
           import { module, test } from 'qunit';
           import { TrackedAsyncData } from 'v2-addon';

           module('Unit | import', function(hooks) {
             test('v2 addons can import() from optional peer dep', async function(assert) {
              assert.ok(TrackedAsyncData, 'import success');
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

      test(`yarn test`, async function (assert) {
        let result = await app.execute('yarn test');
        assert.equal(result.exitCode, 0, result.output);
      });
    });
  });
