import path from 'path';
import { appScenarios, baseV2Addon } from './scenarios';
import { PreparedApp } from 'scenario-tester';
import QUnit from 'qunit';
import merge from 'lodash/merge';
import type { ExpectFile } from '@embroider/test-support/file-assertions/qunit';
import { expectFilesAt } from '@embroider/test-support/file-assertions/qunit';

const { module: Qmodule, test } = QUnit;

appScenarios
  // we are primarily interested in the v2 addon build, we don't need to repeat
  // it per host-app version
  .only('release')
  .map('v2-addon-dev-js', async project => {
    let addon = baseV2Addon();
    addon.pkg.name = 'v2-addon';
    addon.pkg.files = ['dist'];
    addon.pkg.exports = {
      './*': './dist/*.js',
      './addon-main.js': './addon-main.js',
      './package.json': './package.json',
    };
    addon.pkg.scripts = {
      build: 'node ./node_modules/rollup/dist/bin/rollup -c ./rollup.config.mjs',
    };

    merge(addon.files, {
      'babel.config.json': `
        {
          "plugins": [
            "@embroider/addon-dev/template-colocation-plugin",
            "@babel/plugin-transform-class-static-block",
            ["babel-plugin-ember-template-compilation", {
              targetFormat: 'hbs',
              compilerPath: 'ember-source/dist/ember-template-compiler',
              transforms: [
                './lib/custom-transform.js',
              ],
            }],
            ["@babel/plugin-proposal-decorators", { "legacy": true }],
            [ "@babel/plugin-transform-class-properties" ]
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

            addon.appReexports(['components/**/*.js'], {
              mapFilename: (name) => reexportMappings[name] || name,
            }),

            addon.hbs(),
            addon.gjs(),
            addon.dependencies(),

            babel({ babelHelpers: 'bundled', extensions: ['.js', '.hbs', '.gjs'] }),

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
          'single-file-component.gjs': `import Component from '@glimmer/component';
          import Button from './demo/button.js';
          import Another from './another.gjs';
          export default class SingleFileComponent extends Component {
            <template><div data-test-single-file-component>Hello {{@message}}</div><div data-test-another><Another /></div><Button data-test-button @onClick={{this.doIt}} /></template>
            doIt() {}
          }`,
          'another.gjs': `<template>Another GJS</template>`,
          demo: {
            'button.hbs': `
              <button ...attributes {{on 'click' @onClick}}>
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
    addon.linkDependency('babel-plugin-ember-template-compilation', { baseDir: __dirname });
    addon.linkDevDependency('@babel/core', { baseDir: __dirname });
    addon.linkDevDependency('@babel/plugin-transform-class-static-block', { baseDir: __dirname });
    addon.linkDevDependency('@babel/plugin-transform-class-properties', { baseDir: __dirname });
    addon.linkDevDependency('@babel/plugin-proposal-decorators', { baseDir: __dirname });
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

            test('<SingleFileComponent @message="bob" />', async function(assert) {
              await render(hbs\`<SingleFileComponent @message="bob" />\`);

              assert.dom('[data-test-single-file-component]').containsText('Hello bob');
              assert.dom('[data-test-another]').containsText('Another GJS');
              assert.dom('[data-test-button]').containsText('flip');
            })

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
        let result = await inDependency(app, 'v2-addon').execute('pnpm build');
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
            './components/another.js': './dist/_app_/components/another.js',
            './components/demo/button.js': './dist/_app_/components/demo/button.js',
            './components/single-file-component.js': './dist/_app_/components/single-file-component.js',
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
            /TEMPLATE = precompileTemplate\("Hello there/,
            'template is still in hbs format'
          );
        });

        test('gjs components compiled correctly', async function () {
          expectFile('dist/components/single-file-component.js').equalsCode(`import Component from '@glimmer/component';
import Button from "./demo/button.js";
import Another from "./another.js";
import { precompileTemplate } from '@ember/template-compilation';
import { setComponentTemplate } from '@ember/component';
var _class;
class SingleFileComponent extends Component {
  doIt() {}
}
_class = SingleFileComponent;
setComponentTemplate(
  precompileTemplate(
  "<div data-test-single-file-component>Hello {{@message}}</div><div data-test-another><Another /></div><Button data-test-button @onClick={{this.doIt}} />",
  {
  scope: () => ({
    Another,
    Button,
  }),
  strictMode: true
}), _class);

export { SingleFileComponent as default };
//# sourceMappingURL=single-file-component.js.map`);
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
