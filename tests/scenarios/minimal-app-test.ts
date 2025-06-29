import { minimalAppScenarios } from './scenarios';
import type { PreparedApp } from 'scenario-tester';
import QUnit from 'qunit';
import fetch from 'node-fetch';
import CommandWatcher from './helpers/command-watcher';
import { setupAuditTest } from '@embroider/test-support/audit-assertions';

const { module: Qmodule, test } = QUnit;

/**
 * We use canary because this test depends on v6.3.0-alpha-3 or above. We should update this accordingly as the release
 * train progresses
 */
minimalAppScenarios
  .only('canary')
  .map('minimal-app', app => {
    // These are for a custom testem setup that will let us do runtime tests
    // inside `vite dev` rather than only against the output of `vite build`.
    //
    // Most apps should run their CI against `vite build`, as that's closer to
    // production. And they can do development tests directly in brower against
    // `vite dev` at `/tests/index.html`. We're doing `vite dev` in CI here
    // because we're testing the development experience itself.
    app.linkDevDependency('testem', { baseDir: __dirname });
    app.linkDevDependency('@embroider/test-support', { baseDir: __dirname });

    app.linkDevDependency('ember-page-title', { baseDir: __dirname });
    app.linkDevDependency('ember-welcome-page', { baseDir: __dirname });
    app.mergeFiles({
      'testem-dev.cjs': `
      'use strict';

      module.exports = {
        test_page: 'tests?hidepassed',
        disable_watching: true,
        launch_in_ci: ['Chrome'],
        launch_in_dev: ['Chrome'],
        browser_start_timeout: 120,
        browser_args: {
          Chrome: {
            ci: [
              // --no-sandbox is needed when running Chrome inside a container
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
          require('@embroider/test-support/testem-proxy').testemProxy('http://localhost:4200')
        ],
      };
    `,

      src: {
        styles: {
          'app.css': `
            legend {
              font-style: italic;
            }
          `,
        },
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
          'clicker.gts': `
            import Component from '@glimmer/component';
            import { tracked } from '@glimmer/tracking';

            export class Clicker extends Component {
              @tracked count = 0;

              increment = () => this.count++;

              <template>
                <output>{{this.count}}</output>
                <button {{on "click" this.increment}}>++</button>
              </template>
            }
          `,
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
          import FancyComponent from 'app-template-minimal/components/fancy-component.gjs';
          import WelcomePage from 'ember-welcome-page/components/welcome-page'

          <template>
            <FancyButton />
            <FancyComponent />
            <WelcomePage />
          </template>
        `,
        },
        lib: {
          'app-lib-one.js': `
          globalThis.appLibOneLoaded = (globalThis.appLibOneLoaded ?? 0) + 1;
          export default function() { return 'app-lib-one'; }
        `,
          'app-lib-two.js': `
          globalThis.appLibTwoLoaded = (globalThis.appLibTwoLoaded ?? 0) + 1;
          export default function() { return 'app-lib-two'; }
        `,
        },
      },
      tests: {
        application: {
          'style-test.js': `
            import { setupApplicationTest } from 'ember-qunit';
            import { test, module } from 'qunit';
            import { visit } from '@ember/test-helpers';

            module('styles', function (hooks) {
              setupApplicationTest(hooks);

              test('legend is italic', async function (assert) {
                await visit('/');

                assert.dom('legend').hasStyle({ fontStyle: 'italic' });
              });
            });
            `,
        },
        rendering: {
          'clicker-test.gts': `
            import { module, test } from 'qunit';
            import { setupRenderingTest } from 'app-template-minimal/tests/helpers';
            import { click, render } from '@ember/test-helpers';

            import { Clicker } from '#src/components/clicker.gts';

            module('Rendering | <Clicker>', function (hooks) {
              setupRenderingTest(hooks);

              test('it works', async function (assert) {
                await render(
                  <template>
                    <Clicker />
                  </template>
                );

                assert.dom('output').hasText('0');

                await click('button');
                assert.dom('output').hasText('1');

                await click('button');
                assert.dom('output').hasText('2');
              });
            });
          `,
        },
        integration: {
          components: {
            'fancy-component-test.gjs': `
                        import { module, test } from 'qunit';
            import { setupRenderingTest } from 'app-template-minimal/tests/helpers';
            import { render } from '@ember/test-helpers';
            import FancyComponent from '#src/components/fancy-component.gjs';

            module('Integration | Component | fancy-component', function (hooks) {
              setupRenderingTest(hooks);

              test('it renders', async function (assert) {
                // Set any properties with this.set('myProperty', 'value');
                // Handle any actions with this.set('myAction', function(val) { ... });

                await render(<template><FancyComponent></FancyComponent></template>);

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
      let server: CommandWatcher;
      let appURL: string;

      hooks.before(async () => {
        app = await scenario.prepare();
      });

      Qmodule('vite dev', function (hooks) {
        hooks.before(async () => {
          server = CommandWatcher.launch('vite', ['--clearScreen', 'false'], { cwd: app.dir });
          [, appURL] = await server.waitFor(/Local:\s+(https?:\/\/.*)\//g);
        });

        let expectAudit = setupAuditTest(hooks, () => ({
          appURL,
          startingFrom: ['index.html'],
          fetch: fetch as unknown as typeof globalThis.fetch,
        }));

        hooks.after(async () => {
          await server?.shutdown();
        });

        test(`dep optimization of a v2 addon`, async function (assert) {
          expectAudit
            .module('./index.html')
            .resolves(/\/index.html.*/) // in-html app-boot script
            .toModule()
            .resolves(/\/app\.js.*/)
            .toModule()
            .resolves(/\/registry\.js.*/)
            .toModule()
            .resolves(/\/src\/templates\/application.gjs.*/) // page-title is being imported by this template so we should go through here
            .toModule()
            .withContents((src, imports) => {
              let pageTitleImports = imports.filter(imp => /page-title/.test(imp.source));
              assert.ok(pageTitleImports.length > 0, `should have at least one import from page-title. Source: ${src}`);
              for (let pageTitleImport of pageTitleImports) {
                assert.ok(
                  /\.vite\/deps/.test(pageTitleImport.source),
                  `expected ${pageTitleImport.source} to be in vite deps`
                );
              }
              return true;
            });
        });

        test('run test suite against vite dev', async function (assert) {
          let result = await app.execute('pnpm testem --file testem-dev.cjs ci');
          assert.equal(result.exitCode, 0, result.output);
        });
      });

      Qmodule('vite optimize', function () {
        test('vite optimize should succeed', async function (assert) {
          let result = await app.execute('pnpm vite optimize --force');

          assert.equal(result.exitCode, 0, result.output);
        });
      });

      Qmodule('vite build', function () {
        test('run tests suite against vite build output', async function (assert) {
          let result = await app.execute('pnpm vite build --mode test');
          assert.equal(result.exitCode, 0, result.output);
          result = await app.execute('pnpm ember test --path dist --config-file ./testem.cjs');
          assert.equal(result.exitCode, 0, result.output);
        });
      });
    });
  });
