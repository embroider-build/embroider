import { webpackMinimalAppScenarios } from './scenarios';
import type { PreparedApp } from 'scenario-tester';
import QUnit from 'qunit';
import { readFileSync, writeFileSync } from 'fs-extra';
import { resolve } from 'path';
import CommandWatcher from './helpers/command-watcher';

const { module: Qmodule, test } = QUnit;

/**
 * The webpack mirror of `minimal-app-test.ts`. The "minimal" app is a fully-v2
 * app (src/ layout, `type: module`, no ember-cli-build.js / compat prebuild),
 * so its webpack.config.cjs uses only `ember()` — never
 * `classicEmberSupport()`. This exercises the @embroider/webpack code path
 * that has no compat prebuild, no content-for, and no resolver-virtual
 * vendor/test-support entrypoints.
 *
 * Uses canary because (like the vite minimal test) the minimal app template
 * depends on ember-source v6.3.0-alpha.3 or above.
 */
webpackMinimalAppScenarios
  .only('canary')
  .map('webpack-minimal-app', app => {
    // Like `webpack-app-test`'s `webpack dev` module, we run the suite inside
    // a live `webpack serve` (not only against `webpack build` output),
    // because the dev server is the thing being tested here.
    app.linkDevDependency('testem', { baseDir: __dirname });
    app.linkDevDependency('@embroider/test-support', { baseDir: __dirname });
    app.linkDevDependency('@ember/test-waiters', { baseDir: __dirname, resolveName: '@ember/test-waiters-4' });
    // NB: unlike the vite minimal test we deliberately do NOT pull in
    // ember-welcome-page here. It's a classic (v1) addon, and resolving v1
    // addons requires the compat prebuild / resolver.json, which a fully-v2
    // app built with `ember()` alone (no classicEmberSupport) does not have.
    // That's a separate feature; this test stays focused on the pure-v2 path.

    app.mergeFiles({
      'testem-dev.cjs': `
        'use strict';

        module.exports = {
          test_page: '/tests/index.html?hidepassed',
          disable_watching: true,
          launch_in_ci: ['Chrome'],
          launch_in_dev: ['Chrome'],
          browser_start_timeout: 120,
          browser_args: {
            Chrome: {
              ci: [
                process.env.CI ? '--no-sandbox' : null,
                '--headless',
                '--disable-dev-shm-usage',
                '--disable-software-rasterizer',
                '--mute-audio',
                '--remote-debugging-port=0',
                '--window-size=1440,900',
              ].filter(Boolean),
            },
          },
          middleware: [
            require('@embroider/test-support/testem-proxy').testemProxy('http://localhost:4200', '/'),
          ],
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
          'fancy-button.gjs': `<template><h1>I'm fancy</h1></template>`,
        },
        templates: {
          'application.gjs': `
            import pageTitle from 'ember-page-title/helpers/page-title';

            <template>
              {{pageTitle "MyApp"}}
              {{outlet}}
            </template>
          `,
          'index.gjs': `
            import FancyButton from '../components/fancy-button.gjs';
            import FancyComponent from 'app-template-webpack-minimal/components/fancy-component.gjs';

            <template>
              <FancyButton />
              <FancyComponent />
            </template>
          `,
        },
      },
      tests: {
        'debug-test.js': `
          import { test, module } from 'qunit';
          import { assert } from '@ember/debug';
          import { DEBUG } from '@glimmer/env';
          import { isDevelopingApp, isTesting } from '@embroider/macros';

          module('debug utils remain in the build', function () {
            test('assert', function(qAssert) {
              qAssert.throws(() => {
                assert('should throw');
              }, /should throw/, \`The error "should throw" is thrown\`);
            });

            test('isTesting', function (assert) {
              assert.strictEqual(isTesting(), true, \`isTesting() === true\`);
            });

            test('isDevelopingApp', function (assert) {
              assert.strictEqual(isDevelopingApp(), true, \`isDevelopingApp() === true\`);
            });

            module('not supported', function () {
              test('DEBUG', function (assert) {
                if (DEBUG) {
                  assert.step('DEBUG');
                }
                assert.verifySteps([]);
              });
            });
          });
        `,
        integration: {
          components: {
            'fancy-component-test.gjs': `
              import { module, test } from 'qunit';
              import { setupRenderingTest } from 'app-template-webpack-minimal/tests/helpers';
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

      hooks.before(async () => {
        app = await scenario.prepare();
      });

      Qmodule('webpack dev', function (hooks) {
        let server: CommandWatcher;

        hooks.before(async () => {
          server = CommandWatcher.launch('webpack', ['serve', '--mode', 'development', '--port', 'auto'], {
            cwd: app.dir,
          });
          let [, appURL] = await server.waitFor(/Loopback:\s+(https?:\/\/[^\s/]+(?::\d+)?)/, 10 * 60 * 1000);

          let testem = readFileSync(resolve(app.dir, 'testem-dev.cjs')).toString();
          testem = testem.replace(`.testemProxy('http://localhost:4200', '/')`, `.testemProxy('${appURL}', '/')`);
          writeFileSync(resolve(app.dir, 'testem-dev.cjs'), testem);
        });

        hooks.after(async () => {
          await server?.shutdown();
        });

        test('run test suite against webpack serve', async function (assert) {
          assert.timeout(10 * 60 * 1000);
          let result = await app.execute('pnpm testem --file testem-dev.cjs ci');
          assert.equal(result.exitCode, 0, result.output);
        });
      });

      Qmodule('webpack build', function () {
        test('run tests suite against webpack build output', async function (assert) {
          assert.timeout(10 * 60 * 1000);
          let result = await app.execute('pnpm build:test');
          assert.equal(result.exitCode, 0, result.output);

          result = await app.execute('pnpm ember test --path dist --config-file ./testem.cjs');
          assert.equal(result.exitCode, 0, result.output);

          for (let output of [
            'debug utils remain in the build: assert',
            'debug utils remain in the build: isTesting',
            'debug utils remain in the build: isDevelopingApp',
            'debug utils remain in the build > not supported: DEBUG',
            'fancy-component: it renders',
          ]) {
            let actual = result.stdout.includes(output);
            if (!actual) {
              console.log(result.stdout);
            }
            assert.ok(actual, `stdout includes \`${output}\``);
          }
        });
        // NB: like the vite minimal test, we deliberately do not run a
        // production build of the minimal app — its config.js calls
        // `setTesting()` from `enterTestMode()`, which is only valid in
        // @embroider/macros' runtime (development) mode.
      });
    });
  });
