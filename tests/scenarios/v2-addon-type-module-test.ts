import path from 'path';
import { appScenarios, baseV2Addon } from './scenarios';
import { PreparedApp } from 'scenario-tester';
import QUnit from 'qunit';
import merge from 'lodash/merge';
import { pathExistsSync } from 'fs-extra';

const { module: Qmodule, test } = QUnit;

appScenarios
  .only('release')
  .map('v2-addon-as-type-module', async project => {
    let addon = baseV2Addon();
    addon.pkg.name = 'v2-addon';
    addon.pkg.type = 'module';
    addon.pkg.files = ['dist'];
    addon.pkg.exports = {
      '.': './dist/index.js',
      './*': './dist/*.js',
      './addon-main.cjs': './addon-main.cjs',
      // needed for our "inDependency" function defined in this test
      './package.json': './package.json',
    };
    addon.pkg.scripts = {
      build: 'node ./node_modules/rollup/dist/bin/rollup -c ./rollup.config.mjs',
    };

    merge(addon.files, {
      'rollup.config.mjs': `
      import { Addon } from '@embroider/addon-dev/rollup';
      import { babel } from '@rollup/plugin-babel';

      const addon = new Addon({
        srcDir: 'src',
        destDir: 'dist',
      });

      export default {
        output: addon.output(),
        plugins: [
          addon.publicEntrypoints(['**/*.js']),
          addon.dependencies(),
          babel({ extensions: ['.js'], babelHelpers: 'bundled' }),
          addon.clean(),
        ],
      };

      `,
      src: {
        'index.js': `
          import { importSync, isDevelopingApp, macroCondition } from '@embroider/macros';

          export let foo = 'module';

          if (macroCondition(isDevelopingApp())) {
            // value will be asserted in the test
            foo = 'macro'
          }
        `,
      },
    });

    addon.linkDependency('@embroider/addon-shim', { baseDir: __dirname });
    addon.linkDependency('@embroider/addon-dev', { baseDir: __dirname });
    addon.linkDependency('@babel/runtime', { baseDir: __dirname });
    addon.linkDevDependency('@babel/core', { baseDir: __dirname });
    addon.linkDevDependency('@rollup/plugin-babel', { baseDir: __dirname });
    addon.linkDevDependency('rollup', { baseDir: __dirname });

    project.addDevDependency(addon);
    project.linkDevDependency('ember-cli-babel', { baseDir: __dirname, resolveName: 'ember-cli-babel-8' });
    project.linkDevDependency('@embroider/macros', { baseDir: __dirname });

    merge(project.files, {
      tests: {
        // the app is not set up with typescript
        'the-test.js': `
          import { module, test } from 'qunit';
          import { foo } from 'v2-addon';

          module('v2 addon tests', function (hooks) {
            test('macros ran', async function (assert) {
              assert.strictEqual(foo, 'macro');
            });
          });
        `,
      },
      'ember-cli-build.js': `
      'use strict';

      const EmberApp = require('ember-cli/lib/broccoli/ember-app');

      module.exports = function (defaults) {
        let app = new EmberApp(defaults, {
        });

        const { compatBuild, recommendedOptions } = require('@embroider/compat');

        const Webpack = require('@embroider/webpack').Webpack;
        return compatBuild(app, Webpack, {
          ...recommendedOptions.optimized,
          skipBabel: [
            { package: 'qunit' },
          ],
        });
      };
    `,
    });
  })
  .forEachScenario(scenario => {
    Qmodule(scenario.name, function (hooks) {
      let app: PreparedApp;

      hooks.before(async () => {
        app = await scenario.prepare();
        let result = await inDependency(app, 'v2-addon').execute('pnpm build');
        if (result.exitCode !== 0) {
          throw new Error(result.output);
        }
      });

      Qmodule('The addon', function () {
        test('output directories exist', async function (assert) {
          let { dir } = inDependency(app, 'v2-addon');
          assert.strictEqual(pathExistsSync(path.join(dir, 'dist')), true, 'dist/');
        });
      });

      Qmodule('Consuming app', function () {
        test(`pnpm test`, async function (assert) {
          let result = await app.execute('pnpm test');
          assert.equal(result.exitCode, 0, result.output);
        });
      });
    });
  });

// https://github.com/ef4/scenario-tester/issues/5
function inDependency(app: PreparedApp, dependencyName: string): PreparedApp {
  return new PreparedApp(path.dirname(require.resolve(`${dependencyName}/package.json`, { paths: [app.dir] })));
}
