import path from 'path';
import { appScenarios, baseV2Addon } from './scenarios';
import { PreparedApp } from 'scenario-tester';
import QUnit from 'qunit';
import merge from 'lodash/merge';
import { pathExistsSync, readJsonSync, readFileSync } from 'fs-extra';

const { module: Qmodule, test } = QUnit;

appScenarios
  .only('release')
  .map('v2-addon-as-type-module', async project => {
    let addon = baseV2Addon();
    addon.pkg.name = 'v2-addon';
    addon.pkg.type = 'module';
    addon.pkg.files = ['dist'];
    addon.pkg.exports = {
      './*': './dist/*.js',
      './addon-main.cjs': './addon-main.cjs',
      // needed for our "inDependency" function defined in this test
      './package.json': './package.json',
    };
    addon.pkg.scripts = {
      build: 'node ./node_modules/rollup/dist/bin/rollup -c ./rollup.config.mjs',
    };

    merge(addon.files, {
      'babel.config.json': `
        {
          "plugins": [
            ["babel-plugin-ember-template-compilation", {
              "targetFormat": "hbs",
              "transforms": []
            }],
            ["module:decorator-transforms", { "runtime": { "import": "decorator-transforms/runtime" } }]
          ]
        }
      `,
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
          addon.appReexports(['components/*.js']),
          addon.dependencies(),
          babel({ extensions: ['.js', '.gjs', '.ts', '.gts'], babelHelpers: 'bundled' }),
          addon.gjs(),
          addon.hbs(),
          addon.keepAssets(["**/*.css"]),
          addon.clean(),
        ],
      };

      `,
      src: {
        components: {
          'styles.css': `button { font-weight: bold; color: blue; }`,
          'demo.gjs': `
            import Component from '@glimmer/component';
            import { tracked } from '@glimmer/tracking';
            import { on } from '@ember/modifier';

            import { importSync, isDevelopingApp, macroCondition } from '@embroider/macros';

            if (macroCondition(isDevelopingApp())) {
              importSync('./styles.css');
            }

            export default class ExampleComponent extends Component {
              @tracked active = false;

              flip = () => (this.active = !this.active);

              <template>
                Hello there!

                <out>{{this.active}}</out>

                <button {{on 'click' this.flip}}>flip</button>
              </template>
            }
          `,
        },
      },
    });

    addon.linkDependency('@embroider/addon-shim', { baseDir: __dirname });
    addon.linkDependency('@embroider/addon-dev', { baseDir: __dirname });
    addon.linkDependency('@babel/runtime', { baseDir: __dirname });
    addon.linkDevDependency('@babel/core', { baseDir: __dirname });
    addon.linkDevDependency('@rollup/plugin-babel', { baseDir: __dirname });
    addon.linkDependency('decorator-transforms', { baseDir: __dirname });
    addon.linkDevDependency('rollup', { baseDir: __dirname });

    project.addDevDependency(addon);
    project.linkDevDependency('ember-cli-babel', { baseDir: __dirname, resolveName: 'ember-cli-babel-8' });
    project.linkDevDependency('@embroider/macros', { baseDir: __dirname });

    merge(project.files, {
      tests: {
        // the app is not set up with typescript
        'the-test.js': `
          import { click, render } from '@ember/test-helpers';
          import { hbs } from 'ember-cli-htmlbars';
          import { module, test } from 'qunit';
          import { setupRenderingTest } from 'ember-qunit';

          module('v2 addon tests', function (hooks) {
            setupRenderingTest(hooks);

            test('<Demo />', async function (assert) {
              await render(hbs\`<Demo />\`);

              assert.dom('out').containsText('false');

              await click('button');

              assert.dom('out').containsText('true');
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
          assert.strictEqual(pathExistsSync(path.join(dir, 'dist', '_app_')), true, 'dist/_app_');
        });

        test('package.json is modified appropriately', async function (assert) {
          let { dir } = inDependency(app, 'v2-addon');
          let reExports = readJsonSync(path.join(dir, 'package.json'))['ember-addon']['app-js'];

          assert.deepEqual(reExports, {
            './components/demo.js': './dist/_app_/components/demo.js',
          });
        });

        test('the addon was built successfully', async function (assert) {
          let { dir } = inDependency(app, 'v2-addon');
          let expectedModules = {
            './dist/_app_/components/demo.js': 'export { default } from "v2-addon/components/demo";\n',
          };

          assert.strictEqual(
            Object.keys(readJsonSync(path.join(dir, 'package.json'))['ember-addon']['app-js']).length,
            Object.keys(expectedModules).length
          );

          for (let [pathName, moduleContents] of Object.entries(expectedModules)) {
            let filePath = path.join(dir, pathName);
            assert.deepEqual(pathExistsSync(filePath), true, `pathExists: ${pathName}`);
            assert.strictEqual(
              readFileSync(filePath, { encoding: 'utf8' }),
              moduleContents,
              `has correct reexport: ${pathName}`
            );
          }
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
