import path from 'path';
import { appScenarios, baseV2Addon } from './scenarios';
import { PreparedApp } from 'scenario-tester';
import QUnit from 'qunit';
import merge from 'lodash/merge';
import { pathExistsSync, readJsonSync } from 'fs-extra';

const { module: Qmodule, test } = QUnit;

// Builds a TypeScript v2 addon with tsdown, where tsdown's `dts` (oxc isolated
// declarations) replaces the separate glint/ember-tsc declaration step. The
// `.gts` source is written to satisfy isolated declarations (explicit types on
// exports), which is the documented requirement of this path.
appScenarios
  .only('canary')
  .map('v2-addon-dev-tsdown-typescript', async project => {
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
    addon.pkg['ember-addon']['app-js'] = {};

    merge(addon.files, {
      'babel.config.json': `
        {
          "plugins": [
            "@babel/plugin-transform-typescript",
            "@embroider/addon-dev/template-colocation-plugin",
            "@babel/plugin-transform-class-static-block",
            ["babel-plugin-ember-template-compilation", { "targetFormat": "hbs" }],
            ["@babel/plugin-proposal-decorators", { "legacy": true }],
            ["@babel/plugin-transform-class-properties"]
          ]
        }
      `,
      'tsconfig.json': `
        {
          "compilerOptions": {
            "module": "ESNext",
            "target": "ESNext",
            "moduleResolution": "bundler",
            "isolatedDeclarations": true,
            "declaration": true,
            "emitDeclarationOnly": true,
            "strict": true,
            "experimentalDecorators": true,
            "allowImportingTsExtensions": true
          },
          "include": ["src/**/*"]
        }
      `,
      'tsdown.config.js': `
        import { babel } from '@rollup/plugin-babel';
        import { defineConfig } from 'tsdown';
        import { Addon } from '@embroider/addon-dev/rollup';
        import { tsdown } from '@embroider/addon-dev/tsdown';

        const addon = new Addon({
          srcDir: 'src',
          destDir: 'dist',
        });

        export default defineConfig(
          tsdown(addon, {
            publicEntrypoints: [
              'components/**/*.js',
              'utils/**/*.js',
            ],
            appReexports: ['components/**/*.js'],

            // tsdown emits the declarations - no glint/ember-tsc step.
            declarations: true,

            plugins: [
              babel({
                babelHelpers: 'inline',
                extensions: ['.js', '.ts', '.gjs', '.gts', '.hbs'],
              }),
            ],
          })
        );
      `,
      src: {
        components: {
          'greeting.gts': `
            import Component from '@glimmer/component';

            export interface GreetingSignature {
              Element: HTMLDivElement;
              Args: { name: string };
            }

            export default class Greeting extends Component<GreetingSignature> {
              get message(): string {
                return 'Hello ' + this.args.name;
              }

              <template>
                <div data-test-greeting ...attributes>{{this.message}}</div>
              </template>
            }
          `,
        },
        utils: {
          'math.ts': `
            export function add(a: number, b: number): number {
              return a + b;
            }
          `,
        },
      },
    });

    addon.linkDependency('@embroider/addon-shim', { baseDir: __dirname });
    addon.linkDependency('@embroider/addon-dev', { baseDir: __dirname });
    addon.linkDependency('@babel/runtime', { baseDir: __dirname });
    addon.linkDevDependency('@babel/core', { baseDir: __dirname });
    addon.linkDevDependency('@babel/plugin-transform-typescript', { baseDir: __dirname });
    addon.linkDevDependency('@babel/plugin-transform-class-static-block', { baseDir: __dirname });
    addon.linkDevDependency('@babel/plugin-transform-class-properties', { baseDir: __dirname });
    addon.linkDevDependency('@babel/plugin-proposal-decorators', { baseDir: __dirname });
    addon.linkDependency('babel-plugin-ember-template-compilation', { baseDir: __dirname });
    addon.linkDevDependency('@rollup/plugin-babel', { baseDir: __dirname });
    addon.linkDevDependency('content-tag', { baseDir: __dirname });
    addon.linkDevDependency('tsdown', { baseDir: __dirname });
    addon.linkDevDependency('typescript', { baseDir: __dirname });

    project.addDevDependency(addon);

    merge(project.files, {
      tests: {
        'the-test.js': `
          import { render } from '@ember/test-helpers';
          import { hbs } from 'ember-cli-htmlbars';
          import { module, test } from 'qunit';
          import { setupRenderingTest } from 'ember-qunit';

          module('v2 addon (tsdown ts) tests', function (hooks) {
            setupRenderingTest(hooks);

            test('<Greeting @name="bob" />', async function (assert) {
              await render(hbs\`<Greeting @name="bob" />\`);
              assert.dom('[data-test-greeting]').containsText('Hello bob');
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

        test('app-js reexports are generated', async function (assert) {
          let { dir } = inDependency(app, 'v2-addon');
          let reExports = readJsonSync(path.join(dir, 'package.json'))['ember-addon']['app-js'];

          assert.deepEqual(reExports, {
            './components/greeting.js': './dist/_app_/components/greeting.js',
          });
        });

        // NOTE: tsdown's declaration generation (rolldown-plugin-dts) hard-codes
        // an exclude of any source under `node_modules`. scenario-tester places
        // the addon at `<app>/node_modules/v2-addon`, so `.d.ts` files are not
        // emitted here even though `declarations: true` is configured. Real
        // addons build at their own repo root, where declarations are emitted -
        // that path is covered by the `tsdown-declarations.test.ts` unit test,
        // which builds in a temp dir outside `node_modules`.
        test('the build still succeeds with declarations enabled', async function (assert) {
          let { dir } = inDependency(app, 'v2-addon');
          assert.strictEqual(
            pathExistsSync(path.join(dir, 'dist/components/greeting.js')),
            true,
            'component js emitted'
          );
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
