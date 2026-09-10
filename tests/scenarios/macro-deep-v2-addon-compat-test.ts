import { appScenarios, baseV2Addon, patchTestWaiters } from './scenarios';
import type { PreparedApp } from 'scenario-tester';
import QUnit from 'qunit';
import merge from 'lodash/merge';
import { readJSONSync, removeSync } from 'fs-extra';
import { join } from 'path';

const resolve = require('resolve');

const { module: Qmodule, test } = QUnit;

appScenarios
  .only('lts_5_12')
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
    project.removeDevDependency('ember-data');
    project.linkDevDependency('@embroider/macros', { baseDir: __dirname });
    project.linkDevDependency('@ember/test-helpers', { baseDir: __dirname, resolveName: 'ember-test-helpers-5' });
    project.linkDevDependency('ember-qunit', { baseDir: __dirname, resolveName: 'ember-qunit-9' });
    project.linkDevDependency('@ember/test-waiters', { baseDir: __dirname, resolveName: '@ember/test-waiters-4' });
    patchTestWaiters(project);

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

      test('pnpm vite build emits a resolvable macros test-support bootstrap', async function (assert) {
        let result = await app.execute('pnpm vite build --mode development');
        assert.equal(result.exitCode, 0, result.output);

        let synthesizedVendorDir = join(
          app.dir,
          'node_modules',
          '.embroider',
          'rewritten-packages',
          '@embroider',
          'synthesized-vendor'
        );
        let implicitTestScripts = readJSONSync(join(synthesizedVendorDir, 'package.json'))['ember-addon'][
          'implicit-test-scripts'
        ];
        let macrosTestSupport = implicitTestScripts.find((script: string) =>
          script.includes('embroider-macros-test-support.js')
        );

        assert.ok(macrosTestSupport, JSON.stringify(implicitTestScripts));
        removeSync(join(synthesizedVendorDir, 'vendor', 'embroider-macros-test-support.js'));

        let resolvedPath: string;
        try {
          resolvedPath = resolve.sync(macrosTestSupport, { basedir: synthesizedVendorDir });
        } catch (error) {
          assert.ok(false, (error as Error).message);
          return;
        }

        assert.ok(resolvedPath.endsWith('embroider-macros-test-support.js'), resolvedPath);
      });

      test('pnpm ember test --path dist', async function (assert) {
        let result = await app.execute('pnpm ember test --path dist');
        assert.equal(result.exitCode, 0, result.output);
      });
    });
  });
