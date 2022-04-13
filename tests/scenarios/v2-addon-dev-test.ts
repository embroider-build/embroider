import path from 'path';
import { appScenarios, baseV2Addon } from './scenarios';
import { PreparedApp } from 'scenario-tester';
import QUnit from 'qunit';
import merge from 'lodash/merge';
import { pathExistsSync, readJsonSync } from 'fs-extra';

const { module: Qmodule, test } = QUnit;

/**
 * The type of addon this is testing with only works in
 * ember-source@3.25+
 */
appScenarios
  .skip('lts_3_16')
  .skip('lts_3_24')
  .map('v2-addon-dev', async project => {
    let addon = baseV2Addon();
    addon.pkg.name = 'v2-addon';
    addon.pkg.files = ['dist'];
    addon.pkg.exports = {
      './*': './dist/*',
      './addon-main.js': './addon-main.js',
      './package.json': './package.json',
    };
    addon.pkg.scripts = {
      build: './node_modules/rollup/dist/bin/rollup -c ./rollup.config.mjs',
    };

    merge(addon.files, {
      'babel.config.json': `
        {
          "presets": [
            ["@babel/preset-env", {
              "targets": ["last 1 firefox versions"]
            }]
          ],
          "plugins": [
            "@embroider/addon-dev/template-colocation-plugin",
            ["@babel/plugin-proposal-decorators", { "legacy": true }],
            [ "@babel/plugin-proposal-class-properties" ]
          ]
        }
      `,
      'rollup.config.mjs': `
        import { babel } from '@rollup/plugin-babel';
        import { Addon } from '@embroider/addon-dev/rollup';

        const addon = new Addon({
          srcDir: 'src',
          destDir: 'dist',
        });

        export default {
          output: addon.output(),

          plugins: [
            addon.publicEntrypoints([
              '**/*.js',
              'components/demo/out.hbs',
            ]),

            addon.appReexports([
              'components/**/*.js',
              'components/demo/out.hbs',
            ]),

            addon.hbs(),
            addon.dependencies(),

            babel({ babelHelpers: 'bundled' }),

            addon.clean(),
          ],
        };
      `,
      src: {
        components: {
          demo: {
            'button.hbs': `
              <button {{on 'click' @onClick}}>
                flip
              </button>
            `,
            'out.hbs': `
              <out>{{yield}}</out>
            `,
            'index.js': `
                import Component from '@glimmer/component';
                import { tracked } from '@glimmer/tracking';

                import FlipButton from './button';
                import BlahButton from './button.hbs';
                import Out from './out';

                export default class ExampleComponent extends Component {
                  Button = FlipButton;
                  Button2 = BlahButton;
                  Out = Out;

                  @tracked active = false;

                  flip = () => (this.active = !this.active);
                }
              `,
            'index.hbs': `
              Hello there!

              <this.Out>{{this.active}}</this.Out>

              <this.Button @onClick={{this.flip}} />
              <this.Button2 @onClick={{this.flip}} />
            `,
          },
        },
      },
    });

    addon.linkDependency('@embroider/addon-shim', { baseDir: __dirname });
    addon.linkDependency('@embroider/addon-dev', { baseDir: __dirname });
    addon.linkDevDependency('@babel/core', { baseDir: __dirname });
    addon.linkDevDependency('@babel/plugin-proposal-class-properties', { baseDir: __dirname });
    addon.linkDevDependency('@babel/plugin-proposal-decorators', { baseDir: __dirname });
    addon.linkDevDependency('@babel/preset-env', { baseDir: __dirname });
    addon.linkDevDependency('@rollup/plugin-babel', { baseDir: __dirname });
    addon.linkDevDependency('rollup', { baseDir: __dirname });

    project.addDevDependency(addon);

    merge(project.files, {
      tests: {
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

            test('<Demo::Out />', async function (assert) {
              await render(hbs\`<Demo::Out>hi</Demo::Out>\`);

              assert.dom('out').containsText('hi');
            });
          });
        `,
      },
    });
  })
  .forEachScenario(scenario => {
    Qmodule(scenario.name, function (hooks) {
      let app: PreparedApp;

      hooks.before(async () => {
        app = await scenario.prepare();
        let result = await inDependency(app, 'v2-addon').execute('yarn build');
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
            './components/demo/index.js': './dist/_app_/components/demo/index.js',
            './components/demo/out.js': './dist/_app_/components/demo/out.js',
          });
        });

        test('the addon was built successfully', async function (assert) {
          let { dir } = inDependency(app, 'v2-addon');
          let files: string[] = Object.values(readJsonSync(path.join(dir, 'package.json'))['ember-addon']['app-js']);

          assert.expect(files.length);

          for (let pathName of files) {
            assert.deepEqual(pathExistsSync(path.join(dir, pathName)), true, `pathExists: ${pathName}`);
          }
        });
      });

      Qmodule('Consuming app', function () {
        test(`yarn test`, async function (assert) {
          let result = await app.execute('yarn test');
          assert.equal(result.exitCode, 0, result.output);
        });
      });
    });
  });

// https://github.com/ef4/scenario-tester/issues/5
function inDependency(app: PreparedApp, dependencyName: string): PreparedApp {
  return new PreparedApp(path.dirname(require.resolve(`${dependencyName}/package.json`, { paths: [app.dir] })));
}
