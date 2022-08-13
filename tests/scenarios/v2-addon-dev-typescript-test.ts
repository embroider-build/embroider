import path from 'path';
import { appScenarios, baseV2Addon } from './scenarios';
import { PreparedApp } from 'scenario-tester';
import QUnit from 'qunit';
import merge from 'lodash/merge';
import { pathExistsSync, readJsonSync, readFileSync } from 'fs-extra';

const { module: Qmodule, test } = QUnit;

appScenarios
  .map('v2-addon-dev-typescript', async project => {
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
            ["@babel/preset-typescript", {}]
          ],
          "plugins": [
            "@embroider/addon-dev/template-colocation-plugin",
            ["@babel/plugin-proposal-decorators", { "legacy": true }],
            ["@babel/plugin-proposal-class-properties"]
          ]
        }
      `,
      'tsconfig.json': `
        {
          "compilerOptions": {
            // So that the test app's type checking doesn't break when we change types
            "composite": true,

            // Path resolution
            "baseUrl": "./src",
            "moduleResolution": "node",
            // We only use tsc for type checking and declaration output
            "emitDeclarationOnly": false,
            "declarationDir": "./dist",
            "declaration": true,
            "declarationMap": true,
            // Build settings
            "noEmitOnError": false,
            "module": "ESNext",
            "target": "ESNext",
            // Features
            "experimentalDecorators": true,
            "allowJs": false,
            "allowSyntheticDefaultImports": true,
            // Strictness / Correctness
            "strict": true,
            "noImplicitAny": true,
            "noImplicitThis": true,
            "alwaysStrict": true,
            "strictNullChecks": true,
            "strictPropertyInitialization": true,
            "noFallthroughCasesInSwitch": true,
            "noUnusedLocals": true,
            "noUnusedParameters": true,
            "noImplicitReturns": true,
            "paths": {
              "[core-types]": ["./core/types"],
              "[deprecated-types]": ["./deprecated-in-v4/types"]
            }
          },
          "include": [
            "src/**/*"
          ]
        }
      `,
      'rollup.config.mjs': `
        import ts from 'rollup-plugin-ts';
        import { Addon } from '@embroider/addon-dev/rollup';

        const addon = new Addon({
          srcDir: 'src',
          destDir: 'dist',
        });

        const reexportMappings = {
          'components/demo/namespace-me.js': 'components/demo/namespace/namespace-me.js',
        };

        export default {
          output: {
            ...addon.output(),
            // Needed until a bug with ember-cli-htmlbars is fixed
            hoistTransitiveImports: false,
          },

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

            ts({
              transpiler: 'babel',
              babelConfig: './babel.config.json',
              browserslist: ['last 2 firefox versions', 'last 2 chrome versions'],
              tsconfig: {
                fileName: 'tsconfig.json',
                hook: (config) => ({
                  ...config,
                  declaration: true,
                  declarationMap: true,
                  declarationDir: './dist',
                }),
              },
            }),

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
            'namespace-me.hbs': `
              namespaced component
            `,
            'index.ts': `
              import Component from '@glimmer/component';
              import { tracked } from '@glimmer/tracking';

              // button is template-only
              // @ts-ignore
              import FlipButton from './button';
              // button is template-only
              // @ts-ignore
              import Out from './out';

              interface Signature {
                Element: null
              }


              export default class ExampleComponent extends Component<Signature> {
                Button = FlipButton;
                Out = Out;

                @tracked active = false;

                flip = () => (this.active = !this.active);
              }
            `,
            'index.hbs': `
              Hello there!

              <this.Out>{{this.active}}</this.Out>

              <this.Button @onClick={{this.flip}} />
            `,
          },
        },
      },
    });

    addon.linkDependency('@embroider/addon-shim', { baseDir: __dirname });
    addon.linkDependency('@embroider/addon-dev', { baseDir: __dirname });
    addon.linkDependency('@babel/runtime', { baseDir: __dirname });
    addon.linkDevDependency('@babel/core', { baseDir: __dirname });
    addon.linkDevDependency('@babel/plugin-proposal-class-properties', { baseDir: __dirname });
    addon.linkDevDependency('@babel/plugin-proposal-decorators', { baseDir: __dirname });
    addon.linkDevDependency('@babel/preset-typescript', { baseDir: __dirname });
    addon.linkDevDependency('rollup-plugin-ts', { baseDir: __dirname });
    addon.linkDevDependency('rollup', { baseDir: __dirname });
    addon.linkDevDependency('typescript', { baseDir: __dirname });
    // required by rollup-plugin-ts (or preset-typescript), but not a peer - not needed in real addons
    addon.linkDevDependency('@babel/plugin-syntax-dynamic-import', { baseDir: __dirname });
    // required by rollup-plugin-ts (or preset-typescript), but not a peer - not needed in real addons
    addon.linkDevDependency('@babel/plugin-transform-runtime', { baseDir: __dirname });
    // required by rollup-plugin-ts (or preset-typescript), but not a peer - not needed in real addons
    addon.linkDevDependency('@babel/preset-env', { baseDir: __dirname });

    project.addDevDependency(addon);

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
            './components/demo/namespace/namespace-me.js': './dist/_app_/components/demo/namespace/namespace-me.js',
          });
        });

        test('the addon was built successfully', async function (assert) {
          let { dir } = inDependency(app, 'v2-addon');
          let expectedModules = {
            './dist/_app_/components/demo/index.js': 'export { default } from "v2-addon/components/demo/index";\n',
            './dist/_app_/components/demo/out.js': 'export { default } from "v2-addon/components/demo/out";\n',
            './dist/_app_/components/demo/namespace/namespace-me.js':
              'export { default } from "v2-addon/components/demo/namespace-me";\n',
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
