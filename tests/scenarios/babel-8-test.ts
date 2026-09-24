/**
 * Notes:
 * - babel 8 is ESM only,
 *   so these tests can only run on a node that supports require(esm)
 *     (^20.19.5 || ^22.18.0 || >= 24.11.0)
 *     (at the time of writing, the repo's default node is 20.19.0 (in npmrc))
 */
import { baseMinimalApp, patchTestWaiters, releaseDeps } from './scenarios';
import type { PreparedApp } from 'scenario-tester';
import { Scenarios } from 'scenario-tester';
import semver from 'semver';
import QUnit from 'qunit';

const { module: Qmodule, test } = QUnit;

Scenarios.fromProject(baseMinimalApp)
  .expand({ release: releaseDeps })
  .map('minimal-babel-8', app => {
    patchTestWaiters(app);

    app.linkDevDependency('ember-qunit', { baseDir: __dirname, resolveName: 'ember-qunit-9' });
    app.linkDevDependency('@babel/core', { baseDir: __dirname, resolveName: 'babel-core-8' });
    app.linkDevDependency('@babel/plugin-transform-runtime', {
      baseDir: __dirname,
      resolveName: 'babel-plugin-transform-runtime-8',
    });
    app.linkDevDependency('@babel/runtime', { baseDir: __dirname, resolveName: 'babel-runtime-8' });
    app.linkDevDependency('decorator-transforms', { baseDir: __dirname, resolveName: 'decorator-transforms-2.4' });

    app.linkDevDependency('@embroider/test-support', { baseDir: __dirname });
    app.linkDevDependency('@ember/test-waiters', { baseDir: __dirname, resolveName: '@ember/test-waiters-4' });
    app.linkDevDependency('@tsconfig/ember', { baseDir: __dirname });

    app.mergeFiles({
      /**
       * babel 8's @babel/plugin-transform-runtime dropped options:
       * - regenerator (gone)
       * - useESModules (default)
       */
      'babel.config.cjs': `
        const { buildMacros } = require('@embroider/macros/babel');

        const macros = buildMacros();

        module.exports = {
          plugins: [
            ['babel-plugin-ember-template-compilation', {
              transforms: [...macros.templateMacros],
            }],
            ['module:decorator-transforms', {
              runtime: {
                import: require.resolve('decorator-transforms/runtime-esm'),
              },
            }],
            ['@babel/plugin-transform-runtime', {
              absoluteRuntime: __dirname,
            }],
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
            import { tracked } from '@glimmer/tracking';

            export default class extends Component {
              @tracked message = "fancy gts";
              <template>
                <div class="fancy-gts">{{this.message}}</div>
              </template>
            }
          `,
        },
      },
      tests: {
        'babel-version-test.js': `
          import { module, test } from 'qunit';
          import { isDevelopingApp, isTesting } from '@embroider/macros';

          module('babel 8 build output', function () {
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
                  await render(FancyComponent);

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

      /**
       * Node 20.19 "supports require(esm)", but it had bugs.
       * This test can only run on 20.19.5 or newer
       */
      if (!semver.gte(process.version, '20.19.5')) {
        throw new Error(`babel 8 needs node >= 20.19.5. Detected: ${process.version}`);
      }

      hooks.before(async () => {
        app = await scenario.prepare();
      });

      test('the app resolved babel 8', async function (assert) {
        let result = await app.execute(`node -p "require('@babel/core/package.json').version"`);

        assert.equal(result.exitCode, 0, result.output);
        assert.ok(/^8\./.test(result.stdout.trim()), `expected babel 8, got ${result.stdout.trim()}`);
      });

      /**
       * Unused in a v2 app, but while we're set up with babel 8, let's test it
       */
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
