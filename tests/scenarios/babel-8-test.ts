import { minimalAppScenarios } from './scenarios';
import type { PreparedApp } from 'scenario-tester';
import { Project } from 'scenario-tester';
import { dirname } from 'path';
import pkgUp from 'pkg-up';
import semver from 'semver';
import QUnit from 'qunit';

const { module: Qmodule, test } = QUnit;

// Babel 8 is ESM-only and embroider is CJS, so this whole scenario rests on
// node's require(esm). Node 20.19.0 through 20.19.4 reject the require when the
// same ESM module is already mid-evaluation, which is exactly what happens here:
// vite.config.mjs imports @rollup/plugin-babel, which imports @babel/core, and
// while that graph is still evaluating @embroider/core requires @babel/core
// synchronously. 20.19.5 fixed it. Babel 8's own engines field asks for even
// more (^22.18.0 || >=24.11.0).
const MIN_NODE = '20.19.5';

// The app's own @babel/* devDependencies are easy to swap, but embroider's
// packages carry their own copies, and scenario-tester links those straight
// from the workspace. Pull each one in as a project of its own so we can point
// its babel at 8 as well, otherwise this scenario would only prove that the app
// builds while embroider quietly keeps using 7.
function useBabel8(app: Project, name: string, ...deps: string[]) {
  let dep = app.dependencyProjects().find(p => p.name === name);
  if (!dep) {
    dep = Project.fromDir(dirname(pkgUp.sync({ cwd: require.resolve(name) })!), { linkDeps: true });
    app.addDependency(dep);
  }
  for (let babelPackage of deps) {
    dep.linkDependency(`@babel/${babelPackage}`, { baseDir: __dirname, resolveName: `babel-${babelPackage}-8` });
  }
}

// A minimal v2 app running the whole build on babel 8. We stay on the minimal
// app template deliberately: the classic pipeline still pulls babel 7 in
// through ember-cli-babel, so it can't answer the question this test is asking.
minimalAppScenarios
  .only('release')
  .map('minimal-babel-8', app => {
    app.linkDevDependency('@babel/core', { baseDir: __dirname, resolveName: 'babel-core-8' });
    app.linkDevDependency('@babel/plugin-transform-runtime', {
      baseDir: __dirname,
      resolveName: 'babel-plugin-transform-runtime-8',
    });
    app.linkDevDependency('@babel/runtime', { baseDir: __dirname, resolveName: 'babel-runtime-8' });
    // 2.4.0 is the first release that widened its @babel/core peer to 8
    app.linkDevDependency('decorator-transforms', { baseDir: __dirname, resolveName: 'decorator-transforms-2.4' });

    useBabel8(app, '@embroider/core', 'core', 'parser', 'traverse');
    useBabel8(app, '@embroider/vite', 'core');

    app.linkDevDependency('@embroider/test-support', { baseDir: __dirname });
    app.linkDevDependency('@ember/test-waiters', { baseDir: __dirname, resolveName: '@ember/test-waiters-4' });
    // the release scenario hands every app a tsconfig that extends this
    app.linkDevDependency('@tsconfig/ember', { baseDir: __dirname });

    app.mergeFiles({
      // Same plugin chain as the stock minimal template, minus the two
      // @babel/plugin-transform-runtime options that babel 8 dropped:
      // `regenerator` is gone entirely, and `useESModules` is now implied by
      // @babel/runtime's exports map.
      'babel.config.cjs': `
        const { buildMacros } = require('@embroider/macros/babel');

        const macros = buildMacros();

        module.exports = {
          plugins: [
            [
              'babel-plugin-ember-template-compilation',
              {
                enableLegacyModules: ['ember-cli-htmlbars'],
                transforms: [...macros.templateMacros],
              },
            ],
            [
              'module:decorator-transforms',
              {
                runtime: {
                  import: require.resolve('decorator-transforms/runtime-esm'),
                },
              },
            ],
            [
              '@babel/plugin-transform-runtime',
              {
                absoluteRuntime: __dirname,
              },
            ],
            ...macros.babelMacros,
          ],

          generatorOpts: {
            compact: false,
          },
        };
      `,
      src: {
        components: {
          'fancy-component.gjs': `
            import Component from '@glimmer/component';
            export default class extends Component {
              message = "fancy gts";
              <template>
                <div class="fancy-gts">{{this.message}}</div>
              </template>
            }
          `,
        },
        templates: {
          'index.gjs': `
            import FancyComponent from 'app-template-minimal/components/fancy-component.gjs';

            <template>
              <FancyComponent />
            </template>
          `,
        },
      },
      tests: {
        'test-helper.js': `import Application from '#/app';
import config, { enterTestMode } from '#config';

import * as QUnit from 'qunit';
import { setApplication } from '@ember/test-helpers';
import { setup } from 'qunit-dom';
import { start as qunitStart, setupEmberOnerrorValidation } from 'ember-qunit';

export function start() {
  enterTestMode();
  setApplication(Application.create(config.APP));
  setup(QUnit.assert);
  setupEmberOnerrorValidation();
  qunitStart();
}`,
        'babel-version-test.js': `
          import { module, test } from 'qunit';
          import { isDevelopingApp, isTesting } from '@embroider/macros';

          module('babel 8 build output', function () {
            // decorator-transforms and @babel/plugin-transform-runtime both ran
            // over this file, so reaching this point at all means the plugin
            // chain survived.
            test('macros were evaluated at build time', function (assert) {
              assert.strictEqual(isTesting(), true);
              assert.strictEqual(isDevelopingApp(), true);
            });
          });
        `,
        integration: {
          components: {
            'fancy-component-test.gjs': `
              import { module, test } from 'qunit';
              import { setupRenderingTest } from 'app-template-minimal/tests/helpers';
              import { render } from '@ember/test-helpers';
              import FancyComponent from '#/components/fancy-component.gjs';

              module('Integration | Component | fancy-component', function (hooks) {
                setupRenderingTest(hooks);

                test('it renders', async function (assert) {
                  await render(<template><FancyComponent /></template>);
                  assert.dom().hasText('fancy gts');
                });
              });
            `,
          },
        },
      },
    });
  })
  .forEachScenario(scenario => {
    Qmodule(scenario.name, function (hooks) {
      let app: PreparedApp;

      if (!semver.gte(process.version, MIN_NODE)) {
        test(`skipped on node ${process.version}`, function (assert) {
          assert.ok(true, `babel 8 needs node >= ${MIN_NODE} here`);
        });
        return;
      }

      hooks.before(async () => {
        app = await scenario.prepare();
      });

      test('the app resolved babel 8', async function (assert) {
        let result = await app.execute(`node -p "require('@babel/core/package.json').version"`);
        assert.equal(result.exitCode, 0, result.output);
        assert.ok(/^8\./.test(result.stdout.trim()), `expected babel 8, got ${result.stdout.trim()}`);
      });

      test('embroider resolved babel 8 too', async function (assert) {
        // the point of the scenario: embroider's own copy of babel, not just the app's
        let result = await app.execute(
          `node -p "require('module').createRequire(require.resolve('@embroider/core')).resolve('@babel/core/package.json')"`
        );
        assert.equal(result.exitCode, 0, result.output);
        let version = require(result.stdout.trim()).version;
        assert.ok(/^8\./.test(version), `expected babel 8, got ${version}`);
      });

      // A minimal v2 app never reaches describeExports (it's for fastboot
      // shadowing and v1 app-js re-exports), so drive it directly against the
      // babel this app resolved.
      test('describeExports works on babel 8', async function (assert) {
        let script = [
          `const { describeExports } = require('@embroider/core/src/describe-exports');`,
          `const { names } = describeExports("export const a = 1; export default 2;", { configFile: false });`,
          `console.log([...names].sort().join(','));`,
        ].join('');
        let result = await app.execute(`node -e ${JSON.stringify(script)}`);
        assert.equal(result.exitCode, 0, result.output);
        assert.equal(result.stdout.trim(), 'a,default');
      });

      test('vite build and the test suite pass', async function (assert) {
        let result = await app.execute('pnpm vite build --mode development', {
          env: { NODE_ENV: 'development' },
        });
        assert.equal(result.exitCode, 0, result.output);

        result = await app.execute('pnpm ember test --path dist --config-file ./testem.cjs');
        assert.equal(result.exitCode, 0, result.output);

        for (let output of [
          'babel 8 build output: macros were evaluated at build time',
          'fancy-component: it renders',
        ]) {
          if (!result.stdout.includes(output)) {
            console.log(result.stdout);
          }
          assert.ok(result.stdout.includes(output), `stdout includes \`${output}\``);
        }
      });
    });
  });
