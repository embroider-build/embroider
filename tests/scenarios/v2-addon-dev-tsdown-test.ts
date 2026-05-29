import path, { resolve } from 'path';
import { appScenarios, baseV2Addon } from './scenarios';
import { PreparedApp } from 'scenario-tester';
import QUnit from 'qunit';
import merge from 'lodash/merge';
import type { ExpectFile } from '@embroider/test-support/file-assertions/qunit';
import { expectFilesAt } from '@embroider/test-support/file-assertions/qunit';
import { writeFileSync } from 'fs';

const { module: Qmodule, test } = QUnit;

// This mirrors `v2-addon-dev-test.ts` but builds the addon with tsdown (rolldown)
// instead of rollup, exercising the `@embroider/addon-dev/tsdown` config builder.
appScenarios
  .only('canary')
  .map('v2-addon-dev-tsdown-js', async project => {
    let addon = baseV2Addon();
    addon.pkg.name = 'v2-addon';
    addon.pkg.files = ['dist'];
    addon.pkg.exports = {
      './*': './dist/*.js',
      './addon-main.js': './addon-main.js',
      './package.json': './package.json',
    };
    addon.pkg.scripts = {
      build: 'tsdown',
    };

    merge(addon.files, {
      'babel.config.json': `
        {
          "plugins": [
            ["@embroider/addon-dev/template-colocation-plugin", {
              exclude: ['**/just-a-template.hbs'],
            }],
            "@babel/plugin-transform-class-static-block",
            ["babel-plugin-ember-template-compilation", {
              targetFormat: 'hbs',
              transforms: [
                './lib/custom-transform.js',
              ],
            }],
            ["@babel/plugin-proposal-decorators", { "legacy": true }],
            [ "@babel/plugin-transform-class-properties" ]
          ]
        }
      `,
      'tsdown.config.js': `
        import { babel } from '@rollup/plugin-babel';
        import { defineConfig } from 'tsdown';
        import { Addon } from '@embroider/addon-dev/rollup';
        import { tsdown } from '@embroider/addon-dev/tsdown';
        import { resolve, dirname } from 'path';

        const addon = new Addon({
          srcDir: 'src',
          destDir: 'dist',
        });

        const reexportMappings = {
          'components/demo/namespace-me.js': 'components/demo/namespace/namespace-me.js',
        };

        export default defineConfig(
          tsdown(addon, {
            publicEntrypoints: [
              'components/**/*.js',
              'asset-examples/**/*.js',
            ],
            entryExclude: ['**/-excluded/**/*'],

            appReexports: {
              include: ['components/**/*.js'],
              mapFilename: (name) => reexportMappings[name] || name,
              exclude: ['**/-excluded/**/*'],
            },

            // JS addon: no declarations.
            declarations: false,

            hbs: {
              excludeColocation: ['**/just-a-template.hbs'],
            },

            keepAssets: [
              { include: ['**/*.css'] },
              // exercises keepAssets for generated files that have exports
              { include: ['**/*.{xyz,png}'], exports: 'default' },
            ],

            // .xyz is a custom (non-css) asset handled by the plugin below;
            // tell rolldown to treat it as js so keepAssets can capture it.
            loader: { '.xyz': 'js' },

            publicAssets: [['public']],

            plugins: [
              babel({ babelHelpers: 'bundled', extensions: ['.js', '.hbs', '.gjs'] }),

              {
                name: 'virtual-css',
                resolveId(source, importer) {
                  if (source.endsWith('virtual.css')) {
                    return { id: resolve(dirname(importer), source) }
                  }
                },
                load(id) {
                  if (id.endsWith('virtual.css')) {
                    return '.my-blue-example { color: blue }'
                  }
                }
              },
              {
                name: 'custom-plugin',
                resolveId(source, importer) {
                  if (source.endsWith('.xyz')) {
                    return { id: resolve(dirname(importer), source) }
                  }
                },
                load(id) {
                  if (id.endsWith('.xyz')) {
                    return 'Custom Content';
                  }
                }
              },
            ],
          })
        );
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
            'just-a-template.hbs': `<p>I am not a component but a template.</p>`,
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
          '-excluded': {
            'never-import-this.js': `
              throw new Exception('This should never have been imported!');
            `,
          },
        },
        'asset-examples': {
          'has-css-import.js': `
          import "./styles.css";
          `,
          'styles.css': `
            .my-red-example { color: red }
          `,
          'has-virtual-css-import.js': `
            import "./my-virtual.css";
          `,
          'has-custom-asset-import.js': `
            import value from './custom.xyz';
            export function example() {
              return value;
            }
          `,
          'has-binary-import.js': `
            import helloURL from './hello.png';
            export default function() {
              return helloURL;
            }
          `,
        },
      },
      public: {
        'thing.txt': 'hello there',
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
    addon.linkDevDependency('content-tag', { baseDir: __dirname });
    addon.linkDevDependency('tsdown', { baseDir: __dirname });

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

            test('valid image asset is kept in addon', async function (assert) {
              let module = await import('v2-addon/asset-examples/has-binary-import');
              this.url = module.default();
              await render(hbs\`<img alt="hello" src={{this.url}}>\`);
              assert.dom('img').hasStyle({'width': '30px'});
            })
          });
        `,
        'asset-test.js': `
          import { module, test } from 'qunit';

          module('keepAsset', function (hooks) {
            let initialClassList;
            hooks.beforeEach(function() {
              initialClassList = document.body.classList;
            });

            hooks.afterEach(function() {
              document.body.classList = initialClassList;
            });

            test('Normal CSS', async function (assert) {
              await import("v2-addon/asset-examples/has-css-import");
              document.body.classList.add('my-red-example');
              assert.strictEqual(getComputedStyle(document.querySelector('body')).color, 'rgb(255, 0, 0)');
            });

            test("Virtual CSS", async function (assert) {
              await import("v2-addon/asset-examples/has-virtual-css-import");
              document.body.classList.add('my-blue-example');
              assert.strictEqual(getComputedStyle(document.querySelector('body')).color, 'rgb(0, 0, 255)');
            });

            test("custom asset with export", async function(assert) {
              let { example } = await import("v2-addon/asset-examples/has-custom-asset-import");
              assert.strictEqual(example(), "Custom Content");
            });
          })
        `,
      },
    });

    project.files['vite.config.mjs'] = (project.files['vite.config.mjs'] as string).replace(
      '// extra plugins here',
      `{
        name: "xyz-handler",
        transform(code, id) {
          if (id.endsWith('.xyz')) {
            return \`export default "\${code}"\`
          }
        }
      },
    `
    );
  })
  .forEachScenario(scenario => {
    Qmodule(scenario.name, function (hooks) {
      let app: PreparedApp;
      let expectFile: ExpectFile;

      hooks.before(async () => {
        app = await scenario.prepare();
        // fixturify (via scenario-tester) has no binary output support
        let v2AddonPath = path.dirname(require.resolve(`v2-addon/package.json`, { paths: [app.dir] }));
        writeFileSync(
          resolve(v2AddonPath, 'src/asset-examples/hello.png'),
          Buffer.from(
            'iVBORw0KGgoAAAANSUhEUgAAAB4AAAALCAYAAABoKz2KAAACYElEQVQ4y8WU3UuTYRjGf8+77d2XuplL5vdMI0QzwhTRLEgUEqIQwg76Oo7ypD+goIPO60Q6DTq2giAKAiHNvoaRijNDrYk606Fuc9v7Pk8Hs+k6CI/ygvvkgvu5bq7rfm5RVVWl2Ado7BM0gNZqPx6HTnd9gOPlvn83CMGVtgb6u5qpPegBwG7RuNHZxK2uZlw2696Eyzxurp9pRhPQUltBfXkxhlTs9t9UClNmGKUUE+EINf4iAj4vAIZUfJlfoqHSj1vfEVYK0n+99QfW3uY6pheWWUukAKir8PPwWiWfZ37yePgrpw6X0dNUhyYEg+/HGZ5Z4NPcEn1pI2ew0e8L9LU1Zjm3buVmdwv+wgJC4WUevQliqp0RtKOBUp5+mMwS8WSKJ0NBTtZVU+jUuXy6iZGpOUan57nUfgybZW9r0XviCF6Xk4GX72gMlNJaU5JrdfhXlJmV9SwxH1kjtLiKpgm8Ljv5DjtNNeU0BkqJxrewamJPwsWefL4trjC1HGU5ukFt8YGM/dtlffZxMicDtcuOrZRBPJVm4NUo4WicQqdOIm1mcjUlvnwXQmSyVEohpaLEm8dKbIvNRBJfvhuLJshz2lmNJQC4c6ED3WbFGvwRyQpJJZEqswxSKjZTBkPjM9y92EkybRBZj3FvcAilYCQ0x/mWBg75i7j//C2GVIzNLtDf087YbJgXwRC3z3Xw4OpZEimD1xOzCKDA5UC32RC7D4ghFZrIfJmkKbFv52nRNAqcOpGNRI7VSVMiBOialrUxaUosQmDTBKYCn9vBSiyBRWT6UlKCIlf4f+I3ZibyifAuOoEAAAAASUVORK5CYII=',
            'base64'
          )
        );
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

        test('package.json app-js matches the rollup build', async function () {
          expectFile('package.json').json('ember-addon.app-js').deepEquals({
            './components/another.js': './dist/_app_/components/another.js',
            './components/demo/button.js': './dist/_app_/components/demo/button.js',
            './components/single-file-component.js': './dist/_app_/components/single-file-component.js',
            './components/demo/index.js': './dist/_app_/components/demo/index.js',
            './components/demo/just-a-template.js': './dist/_app_/components/demo/just-a-template.js',
            './components/demo/out.js': './dist/_app_/components/demo/out.js',
            './components/demo/namespace/namespace-me.js': './dist/_app_/components/demo/namespace/namespace-me.js',
          });
        });

        test('the addon has expected public entrypoints', async function () {
          expectFile('dist/components/demo/index.js').exists();
          expectFile('dist/components/demo/just-a-template.js').exists();
          expectFile('dist/components/demo/out.js').exists();
          expectFile('dist/components/demo/namespace-me.js').exists();
          expectFile('dist/components/-excluded/never-import-this.js').doesNotExist();
        });

        test('the addon has expected app-reexports', async function () {
          expectFile('dist/_app_/components/demo/index.js').matches(
            'export { default } from "v2-addon/components/demo/index"'
          );
          expectFile('dist/_app_/components/demo/just-a-template.js').matches(
            'export { default } from "v2-addon/components/demo/just-a-template"'
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
            /precompileTemplate\("Hello there/,
            'template is still in hbs format'
          );

          expectFile('dist/components/demo/just-a-template.js').matches(
            'precompileTemplate("<p>I am not a component but a template.</p>")'
          );
        });

        test('gjs components compiled correctly', async function () {
          expectFile('dist/components/single-file-component.js').matches('precompileTemplate');
          expectFile('dist/components/single-file-component.js').matches('setComponentTemplate');
          expectFile('dist/components/single-file-component.js').matches('data-test-single-file-component');
        });

        test('publicAssets are namespaced correctly', async function () {
          expectFile('package.json').json('ember-addon.public-assets').deepEquals({
            './public/thing.txt': '/v2-addon/thing.txt',
          });
        });

        test('keepAssets works for real css files', async function () {
          expectFile('dist/asset-examples/has-css-import.js').matches(`import "./styles.css"`);
          expectFile('dist/asset-examples/styles.css').matches('.my-red-example { color: red }');
        });

        test('keepAssets works for css generated by another plugin', async function () {
          expectFile('dist/asset-examples/has-virtual-css-import.js').matches(`import "./my-virtual.css"`);
          expectFile('dist/asset-examples/my-virtual.css').matches('.my-blue-example { color: blue }');
        });

        test('keepAssets tolerates non-JS content that is interpreted as having a default export', async function () {
          expectFile('dist/asset-examples/has-custom-asset-import.js').matches(`from "./custom.xyz"`);
          expectFile('dist/asset-examples/custom.xyz').matches(`Custom Content`);
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
