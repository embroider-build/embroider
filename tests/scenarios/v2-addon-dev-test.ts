import path from 'path';
import { appScenarios, baseV2Addon } from './scenarios';
import { PreparedApp } from 'scenario-tester';
import QUnit from 'qunit';
import merge from 'lodash/merge';
import { ExpectFile, expectFilesAt } from '@embroider/test-support';

const { module: Qmodule, test } = QUnit;

appScenarios
  .map('v2-addon-dev-js', async project => {
    let addon = baseV2Addon();
    addon.pkg.name = 'v2-addon';
    addon.pkg.files = ['dist'];
    addon.pkg.exports = {
      './*': './dist/*',
      './addon-main.js': './addon-main.js',
      './package.json': './package.json',
    };
    addon.pkg.scripts = {
      build: 'node ./node_modules/rollup/dist/bin/rollup -c ./rollup.config.mjs',
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
            ["@embroider/addon-dev/template-transform-plugin", {
              astTransforms: [
                './lib/custom-transform.js',
              ],
            }],
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

        const reexportMappings = {
          'components/demo/namespace-me.js': 'components/demo/namespace/namespace-me.js',
        };

        export default {
          output: addon.output(),

          plugins: [
            addon.publicEntrypoints([
              'components/**/*.js',
            ]),

            addon.appReexports([
              'components/demo/index.js',
              'components/demo/out.js',
              'components/demo/namespace-me.js',
            ], {
              mapFilename: (name) => reexportMappings[name] || name,
            }),

            addon.hbs(),
            addon.dependencies(),

            babel({ babelHelpers: 'bundled' }),

            addon.clean(),
          ],
        };
      `,
      lib: {
        'custom-transform.js': `
          module.exports = function customTransform(env) {
            return {
              name: 'custom-transform',
              visitor: {
                PathExpression(node) {
                  if (node.original === 'transformMe') {
                    return env.syntax.builders.string("iWasTransformed");
                  }
                },
              },
            };
          }
        `,
      },
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
            'namespace-me.hbs': `
              namespaced component
            `,
            'index.js': `
                import Component from '@glimmer/component';
                import { tracked } from '@glimmer/tracking';

                import FlipButton from './button';
                import Out from './out';

                export default class ExampleComponent extends Component {
                  Button = FlipButton;
                  Out = Out;

                  @tracked active = false;

                  flip = () => (this.active = !this.active);
                }
              `,
            'index.hbs': `Hello there!

              <this.Out>{{this.active}}</this.Out>

              <this.Button @onClick={{this.flip}} />

              <div data-test="should-transform">{{transformMe}}</div>
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

            test('transform worked', async function (assert) {
              await render(hbs\`<Demo />\`);
              assert.dom('[data-test="should-transform"]').containsText('iWasTransformed');
            });

            test('<Demo::Out />', async function (assert) {
              await render(hbs\`<Demo::Out>hi</Demo::Out>\`);

              assert.dom('out').containsText('hi');
            });

            test('<Demo::Namespace::NamespaceMe />', async function (assert) {
              await render(hbs\`<Demo::Namespace::NamespaceMe />\`);

              assert.dom().containsText('namespaced component');
            });
          });
        `,
      },
    });
  })
  .forEachScenario(scenario => {
    Qmodule(scenario.name, function (hooks) {
      let app: PreparedApp;
      let expectFile: ExpectFile;

      hooks.before(async () => {
        app = await scenario.prepare();
        let result = await inDependency(app, 'v2-addon').execute('yarn build');
        if (result.exitCode !== 0) {
          throw new Error(result.output);
        }
      });

      hooks.beforeEach(assert => {
        expectFile = expectFilesAt(inDependency(app, 'v2-addon').dir, { qunit: assert });
      });

      Qmodule('The addon', function () {
        test('output directories exist', async function () {
          expectFile('dist').exists();
          expectFile('dist/_app_').exists();
        });

        test('package.json is modified appropriately', async function () {
          expectFile('package.json').json('ember-addon.app-js').deepEquals({
            './components/demo/index.js': './dist/_app_/components/demo/index.js',
            './components/demo/out.js': './dist/_app_/components/demo/out.js',
            './components/demo/namespace/namespace-me.js': './dist/_app_/components/demo/namespace/namespace-me.js',
          });
        });

        test('the addon was built successfully', async function () {
          expectFile('dist/_app_/components/demo/index.js').matches(
            'export { default } from "v2-addon/components/demo/index"'
          );

          expectFile('dist/_app_/components/demo/out.js').matches(
            'export { default } from "v2-addon/components/demo/out"'
          );
          expectFile('dist/_app_/components/demo/namespace/namespace-me.js').matches(
            'export { default } from "v2-addon/components/demo/namespace-me"'
          );
        });

        test('template transform was run', async function () {
          expectFile('dist/components/demo/index.js').matches('iWasTransformed');
          expectFile('dist/components/demo/index.js').matches(
            /TEMPLATE = hbs\("Hello there/,
            'template is still in hbs format'
          );
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
