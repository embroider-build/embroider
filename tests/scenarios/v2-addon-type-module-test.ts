import { appScenarios, baseV2Addon } from './scenarios';
import type { PreparedApp } from 'scenario-tester';
import QUnit from 'qunit';
import merge from 'lodash/merge';

const { module: Qmodule, test } = QUnit;

appScenarios
  .map('v2-addon-type-module', project => {
    // A v2 addon that sets `"type": "module"` in its package.json. All of
    // its .js files get webpack's strict ESM treatment unless we intervene,
    // which breaks (1) default-imports of the CommonJS modules we
    // externalize (like the `/@embroider/ext-cjs/` virtual modules that
    // stand in for `@ember/component/template-only` in safe mode), (2)
    // imports that aren't fully-specified, like the relative `es-compat2`
    // import that `@embroider/macros` emits for `importSync()`, and (3)
    // `require()` itself, which strict ESM modules aren't allowed to use, so
    // the `require()` calls that `importSync()` compiles to would be left
    // for the runtime AMD loader instead of being handled by webpack.
    let addon = baseV2Addon();
    addon.pkg.name = 'esm-v2-addon';
    addon.pkg.type = 'module';
    // when the package is type=module, the addon-main must be explicitly cjs
    (addon.pkg as any)['ember-addon'].main = 'addon-main.cjs';
    addon.pkg.exports = {
      '.': './index.js',
      './*': './*',
    };
    (addon.pkg as any)['ember-addon']['app-js'] = {
      './components/esm-hello.js': './app/components/esm-hello.js',
      './components/esm-counter.js': './app/components/esm-counter.js',
    };

    merge(addon.files, {
      'addon-main.cjs': `
        const { addonV1Shim } = require('@embroider/addon-shim');
        module.exports = addonV1Shim(__dirname);
      `,
      'index.js': `
        import { two } from './lib';
        export function useDirectoryImport() {
          return two();
        }
      `,
      lib: {
        'index.js': `
          export function two() {
            return 'esm-directory-import-worked';
          }
        `,
      },
      'side-effect.js': `window.__esm_v2_addon_side_effect = 'esm-side-effect-worked';`,
      'uses-import-sync.js': `
        import { importSync } from '@embroider/macros';
        importSync('./side-effect.js');
      `,
      app: {
        components: {
          'esm-hello.js': `export { default } from 'esm-v2-addon/components/esm-hello';`,
          'esm-counter.js': `export { default } from 'esm-v2-addon/components/esm-counter';`,
        },
      },
      components: {
        'esm-hello.js': `
          import { setComponentTemplate } from '@ember/component';
          import { precompileTemplate } from '@ember/template-compilation';
          import templateOnlyComponent from '@ember/component/template-only';
          export default setComponentTemplate(
            precompileTemplate("<div data-test-esm-hello>Hello from ESM</div>", {
              strictMode: true,
            }),
            templateOnlyComponent()
          );
        `,
        'esm-counter.js': `
          import Component from '@glimmer/component';
          import { setComponentTemplate } from '@ember/component';
          import { precompileTemplate } from '@ember/template-compilation';

          class Counter extends Component {
            get count() {
              return 42;
            }
          }

          export default setComponentTemplate(
            precompileTemplate("<div data-test-esm-counter>{{this.count}}</div>", {
              strictMode: true,
            }),
            Counter
          );
        `,
      },
    });

    addon.linkDependency('@embroider/addon-shim', { baseDir: __dirname });
    addon.linkDependency('@embroider/macros', { baseDir: __dirname });

    project.addDevDependency(addon);

    merge(project.files, {
      app: {
        templates: {
          'index.hbs': `<EsmHello /><EsmCounter />`,
        },
      },
      tests: {
        acceptance: {
          'esm-index-test.js': `
            import { module, test } from 'qunit';
            import { visit } from '@ember/test-helpers';
            import { setupApplicationTest } from 'ember-qunit';

            module('Acceptance | index', function (hooks) {
              setupApplicationTest(hooks);

              test('can render a template-only component from a type=module v2 addon', async function (assert) {
                await visit('/');
                assert.equal(document.querySelector('[data-test-esm-hello]').textContent.trim(), 'Hello from ESM');
              });

              test('can render a glimmer component from a type=module v2 addon', async function (assert) {
                await visit('/');
                assert.equal(document.querySelector('[data-test-esm-counter]').textContent.trim(), '42');
              });
            });
          `,
        },
        unit: {
          'esm-import-test.js': `
            import { module, test } from 'qunit';
            import { useDirectoryImport } from 'esm-v2-addon';
            import 'esm-v2-addon/uses-import-sync';

            module('Unit | import from type=module v2 addon', function () {
              test('the addon can use a directory import internally', function (assert) {
                assert.equal(useDirectoryImport(), 'esm-directory-import-worked');
              });

              test('the addon can use importSync from @embroider/macros', function (assert) {
                assert.equal(window.__esm_v2_addon_side_effect, 'esm-side-effect-worked');
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

      test(`pnpm test: safe`, async function (assert) {
        let result = await app.execute('pnpm test', {
          env: {
            EMBROIDER_TEST_SETUP_OPTIONS: 'safe',
            EMBROIDER_TEST_SETUP_FORCE: 'embroider',
          },
        });
        assert.equal(result.exitCode, 0, result.output);
      });

      test(`pnpm test: optimized`, async function (assert) {
        let result = await app.execute('pnpm test', {
          env: {
            EMBROIDER_TEST_SETUP_OPTIONS: 'optimized',
            EMBROIDER_TEST_SETUP_FORCE: 'embroider',
          },
        });
        assert.equal(result.exitCode, 0, result.output);
      });
    });
  });
