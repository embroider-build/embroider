import { appScenarios, baseV2Addon } from './scenarios';
import type { PreparedApp } from 'scenario-tester';
import QUnit from 'qunit';
import merge from 'lodash/merge';

const { module: Qmodule, test } = QUnit;

appScenarios
  .only('release')
  .map('v2-addon-as-type-module', async project => {
    let addon = baseV2Addon();
    addon.pkg.name = 'v2-addon';
    addon.pkg.type = 'module';
    addon.pkg.files = ['src'];
    addon.pkg.exports = {
      './*': './src/*.js',
      './addon-main.cjs': './addon-main.cjs',
    };

    merge(addon.files, {
      src: {
        'side-effecting.js': `window.__secret_side_effect = 'hello';`,
        /**
         * NOTE: importSync shouldn't be used like this in practice,
         * as it's meant for compatibility and macroCondition imports before we have
         * support for top-level await.
         */
        'demo.js': `
          import { importSync } from '@embroider/macros';

          importSync('./side-effecting.js');
        `,
      },
    });

    addon.linkDependency('@embroider/addon-shim', { baseDir: __dirname });

    project.addDevDependency(addon);
    project.linkDevDependency('@embroider/macros', { baseDir: __dirname });

    merge(project.files, {
      tests: {
        // the app is not set up with typescript
        'the-test.js': `
          import { module, test } from 'qunit';
          import 'v2-addon/demo';

          module('v2 addon tests', function (hooks) {
            test('macro condition runs without error', async function (assert) {
              assert.strictEqual(window.__secret_side_effect, 'hello');
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
      });

      Qmodule('Consuming app', function () {
        test(`pnpm test`, async function (assert) {
          let result = await app.execute('pnpm test');
          assert.equal(result.exitCode, 0, result.output);
        });
      });
    });
  });
