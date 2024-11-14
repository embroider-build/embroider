import type { PreparedApp } from 'scenario-tester';
import { appScenarios, baseAddon, baseV2Addon } from './scenarios';
import QUnit from 'qunit';
const { module: Qmodule, test } = QUnit;

import { throwOnWarnings } from '@embroider/core';

appScenarios
  .map('compat-renaming', app => {
    app.mergeFiles({
      app: {
        components: {
          'import-lodash.js': `
          import lodash from 'lodash';
          export default function() {
            return lodash();
          }
          `,
        },
      },
      tests: {
        unit: {
          'basics-test.js': `
            import { module, test } from 'qunit';

            import lodash from 'lodash';
            import capitalize from 'lodash/capitalize';
            import ownThing from 'emits-multiple-packages/own-thing';
            import somebodyElsesEnvironment from 'somebody-elses-package/environment';
            import utils from 'somebody-elses-package/utils';
            import utilsIndex from 'somebody-elses-package/utils/index';
            import utilsIndexJS from 'somebody-elses-package/utils/index.js';
            import singleFilePackage from 'single-file-package';
            import compat from '@embroider/virtual/compat-modules';

            module('Unit | basics', function () {
              test('whole package renaming works for top-level module', async function (assert) {
                assert.strictEqual(lodash(), 'lodash index');
              });
              test('whole package renaming works for interior module', async function (assert) {
                assert.strictEqual(capitalize(), 'lodash capitalize');
              });

              test("modules in own namespace don't get renamed, top level", async function (assert) {
                assert.strictEqual(ownThing(), 'own thing');
              });

              test('modules outside our namespace do get renamed', async function (assert) {
                assert.strictEqual(
                  somebodyElsesEnvironment(),
                  'somebody elses environment'
                );
              });

              test('modules outside our namespace do get renamed', async function (assert) {
                assert.strictEqual(utils(), 'somebody elses utils');
              });

              test('modules outside our namespace do get renamed, with index', async function (assert) {
                assert.strictEqual(utilsIndex(), 'somebody elses utils');
              });

              test('modules outside our namespace do get renamed, with index with extension', async function (assert) {
                assert.strictEqual(utilsIndexJS(), 'somebody elses utils');
              });

              test('single file package gets captured and renamed', function (assert) {
                assert.strictEqual(singleFilePackage(), 'single file package');
              });

              test('renamed modules keep their classic runtime name when used as implicit-modules', function (assert) {
                assert.strictEqual(compat['this-is-implicit/index'].default(), 'this-is-implicit');
              })
            });

          `,
        },
      },
    });

    let emberLodash = baseAddon();
    emberLodash.pkg.name = 'ember-lodash';
    emberLodash.mergeFiles({
      'index.js': `
        module.exports = {
          name: require('./package.json').name,
          moduleName() { return 'lodash'; }
        }
      `,
      addon: {
        'index.js': `export default function() { return "lodash index" }`,
        'capitalize.js': `export default function() { return "lodash capitalize" }`,
      },
    });
    app.addDevDependency(emberLodash);

    let emitsMultiple = baseAddon();
    emitsMultiple.pkg.name = 'emits-multiple-packages';
    emitsMultiple.mergeFiles({
      'index.js': `
        module.exports = {
          name: require('./package.json').name,
          treeForAddon(tree) {
            // doesn't call super so we can escape our namespace
            return tree;
          }
        }
      `,
      addon: {
        'emits-multiple-packages': {
          'own-thing.js': 'export default function() { return "own thing" }',
        },
        'somebody-elses-package': {
          'environment.js': 'export default function(){ return "somebody elses environment" }',
          utils: {
            'index.js': 'export default function(){ return "somebody elses utils" }',
          },
        },
        'single-file-package.js': 'export default function(){ return "single file package" }',
      },
    });
    app.addDependency(emitsMultiple);

    let v2Addon = baseV2Addon();
    v2Addon.name = 'my-v2-addon';
    v2Addon.mergeFiles({
      'this-is-implicit.js': `
        export default function() { return "this-is-implicit" }
      `,
    });
    v2Addon.pkg['ember-addon'] = {
      version: 2,
      type: 'addon',
      'implicit-modules': ['this-is-implicit'],
      'renamed-modules': {
        'this-is-implicit/index.js': 'my-v2-addon/this-is-implicit.js',
      },
      main: 'addon-main.js',
    };
    app.addDependency(v2Addon);
  })
  .forEachScenario(scenario => {
    Qmodule(scenario.name, function (hooks) {
      throwOnWarnings(hooks);

      let app: PreparedApp;

      hooks.before(async () => {
        app = await scenario.prepare();
      });

      test(`pnpm test: development`, async function (assert) {
        let result = await app.execute(`pnpm test`);
        assert.equal(result.exitCode, 0, result.output);
      });
    });
  });
