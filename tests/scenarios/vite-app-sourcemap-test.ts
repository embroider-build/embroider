import { appScenarios } from './scenarios';
import { PreparedApp } from 'scenario-tester';
import QUnit from 'qunit';
import { basename, dirname, join } from 'path';
import { assertTemplateVariableMapsToSource, findMapForVariable } from './helpers/source-maps';
import { sourcemapDemoAddon } from './helpers/sourcemap-addon';

const { module: Qmodule, test } = QUnit;

appScenarios
  .only('canary')
  .map('vite-app-sourcemap', project => {
    project.addDevDependency(sourcemapDemoAddon());

    project.linkDevDependency('@babel/plugin-transform-typescript', { baseDir: __dirname });

    project.mergeFiles({
      'babel.config.cjs': `
        const { babelCompatSupport, templateCompatSupport } = require('@embroider/compat/babel');

        module.exports = {
          plugins: [
            ['@babel/plugin-transform-typescript'],
            [
              'babel-plugin-ember-template-compilation',
              {
                enableLegacyModules: [
                  'ember-cli-htmlbars',
                  'ember-cli-htmlbars-inline-precompile',
                  'htmlbars-inline-precompile',
                ],
                transforms: [...templateCompatSupport()],
              },
            ],
            [
              'module:decorator-transforms',
              {
                runtime: { import: require.resolve('decorator-transforms/runtime-esm') },
              },
            ],
            [
              '@babel/plugin-transform-runtime',
              {
                absoluteRuntime: __dirname,
                useESModules: true,
                regenerator: false,
              },
            ],
            ...babelCompatSupport(),
          ],

          generatorOpts: {
            compact: false,
          },
        };
      `,
      'vite.config.mjs': `
        import { defineConfig } from "vite";
        import { extensions, classicEmberSupport, ember } from "@embroider/vite";
        import { babel } from "@rollup/plugin-babel";

        export default defineConfig({
          build: {
            sourcemap: true,
          },
          plugins: [
            classicEmberSupport(),
            ember(),
            babel({
              babelHelpers: "runtime",
              extensions,
            }),
          ],
        });
      `,
      app: {
        components: {
          'gjs-demo.gjs': `import Component from '@glimmer/component';

const gjsScopedValue = 'gjs-scoped-value';

export default class GjsDemo extends Component {
  <template>
    <span data-test-gjs-demo>{{gjsScopedValue}}</span>
  </template>
}
`,
          'gts-demo.gts': `import Component from '@glimmer/component';

const gtsScopedValue: string = 'gts-scoped-value';

export default class GtsDemo extends Component {
  <template>
    <span data-test-gts-demo>{{gtsScopedValue}}</span>
  </template>
}
`,
        },
        templates: {
          'application.hbs': `<GjsDemo />
<GtsDemo />
<AddonGjsDemo />
<AddonGtsDemo />
{{outlet}}`,
        },
      },
    });
  })
  .forEachScenario(scenario => {
    Qmodule(scenario.name, function (hooks) {
      let app: PreparedApp;
      let distDir: string;

      hooks.before(async () => {
        app = await scenario.prepare();

        let addonResult = await inDependency(app, 'v2-addon').execute('pnpm build');
        if (addonResult.exitCode !== 0) {
          throw new Error(addonResult.output);
        }

        let result = await app.execute('pnpm build');
        if (result.exitCode !== 0) {
          throw new Error(result.output);
        }
        distDir = join(app.dir, 'dist');
      });

      function assertVariableInBuiltMaps(assert: Assert, originalFile: string, variable: string) {
        return (async () => {
          let found = await findMapForVariable(distDir, originalFile, variable);
          assert.ok(found, `a built chunk maps ${variable} back to ${originalFile}`);
          if (!found) {
            return;
          }
          assertTemplateVariableMapsToSource(assert, {
            rawMap: found.rawMap,
            originalFile,
            variable,
            label: basename(found.mapFile),
          });
        })();
      }

      test('app gjs template-scoped variable maps back to its original source', async function (assert) {
        await assertVariableInBuiltMaps(assert, 'gjs-demo.gjs', 'gjsScopedValue');
      });

      test('app gts template-scoped variable maps back to its original source', async function (assert) {
        await assertVariableInBuiltMaps(assert, 'gts-demo.gts', 'gtsScopedValue');
      });

      test('addon gjs code maps back to the addon published module', async function (assert) {
        await assertVariableInBuiltMaps(assert, 'v2-addon/dist/components/addon-gjs-demo.js', 'addonGjsScopedValue');
      });

      test('addon gts code maps back to the addon published module', async function (assert) {
        await assertVariableInBuiltMaps(assert, 'v2-addon/dist/components/addon-gts-demo.js', 'addonGtsScopedValue');
      });
    });
  });

function inDependency(app: PreparedApp, dependencyName: string): PreparedApp {
  return new PreparedApp(dirname(require.resolve(`${dependencyName}/package.json`, { paths: [app.dir] })));
}
