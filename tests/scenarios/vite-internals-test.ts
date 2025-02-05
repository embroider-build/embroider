import { baseAddon, tsAppScenarios } from './scenarios';
import type { PreparedApp, Project, Scenario } from 'scenario-tester';
import QUnit from 'qunit';
import fetch from 'node-fetch';
import CommandWatcher from './helpers/command-watcher';
import { setupAuditTest } from '@embroider/test-support/audit-assertions';

const { module: Qmodule, test } = QUnit;

function buildViteInternalsTest(testNonColocatedTemplates: boolean, app: Project) {
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
    'testem-dev.js': `
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

    app: {
      components: {
        'fancy-gts.gts': `
          import Component from '@glimmer/component';
          export default class extends Component {
            message: string = "fancy gts";
            <template>
              <div class="fancy-gts">{{this.message}}</div>
            </template>
          }
        `,
        'alpha.ts': `
          import Component from '@glimmer/component';
          export default class extends Component {
            message: string = "alpha";
          }
        `,
        'alpha.hbs': `
          <div class="alpha">{{this.message}}</div>
          <Beta />
        `,
        'gamma.js': `
          globalThis.gammaLoaded = (globalThis.gammaLoaded ?? 0) + 1;
          import Component from '@glimmer/component';
          export default class extends Component {
            message = "gamma";
          }
        `,
        'gamma.hbs': `
          <div class="gamma">{{this.message}}</div>
        `,
        'epsilon.hbs': `<div class="epsilon">Epsilon</div>`,
        'fancy-button.hbs': `<h1>I'm fancy</h1>`,
        'delta.js': `
          import Component from '@glimmer/component';
          export default class extends Component {
            message = "delta";
         }
        `,
      },
      templates: {
        'application.hbs': `
          {{page-title "MyApp"}}
          {{outlet}}
        `,
        'index.hbs': `
          <FancyButton />
          <FancyGts />
          <WelcomePage />
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
      unit: {
        'babel-plugin-is-module-test.js': `
          import { module, test } from "qunit";
          module("Unit | babel-plugin-is-module", function () {
            test("it ran", function (assert) {
              assert.strictEqual("sample-transform-target", "sample-transform-result");
            });
          });
        `,
      },
      integration: {
        components: {
          'example-test.js': `
            import { module, test } from 'qunit';
            import { setupRenderingTest } from 'ts-app-template/tests/helpers';
            import { render } from '@ember/test-helpers';
            import { hbs } from 'ember-cli-htmlbars';
            import { appLibOne as libOneViaAddon, appLibTwo as libTwoViaAddon } from 'ts-app-template/v1-example-addon';
            import appLibOne from 'ts-app-template/lib/app-lib-one';
            import appLibTwo from 'ts-app-template/lib/app-lib-two';


            module('Integration | Component | example', function (hooks) {
              setupRenderingTest(hooks);

              test('nesting between app and addon components', async function (assert) {
                await render(hbs\`<Alpha /><Gamma />\`);

                // Alpha in the app...
                assert.dom('.alpha').hasText('alpha');

                // calls beta in the addon...
                assert.dom('.beta').hasText('beta');

                // which calls gamma in the app
                // while the app itself also directly galls Gamma.
                // We want to ensure that we get the same copy of Gamma via both paths.
                assert.dom('.gamma').exists({ count: 2 })

                assert.strictEqual(globalThis.gammaLoaded, 1, 'gamma only evaluated once');
              });

              test("addon depends on an app's hbs-only component", async function (assert) {
                await render(hbs\`<Zeta />\`);
                assert.dom('.zeta').hasText('Zeta');
                assert.dom('.epsilon').hasText('Epsilon');
              });

              ${(() => {
                if (testNonColocatedTemplates) {
                  return `
              test("paired component between app and addon", async function (assert) {
                await render(hbs\`<Delta />\`);
                assert.dom('.delta').hasText('delta');
              });
              `;
                } else {
                  return '';
                }
              })()}


              test("addon depends on an app's module via relative import", async function (assert) {
                assert.strictEqual(appLibOne(), libOneViaAddon(), 'lib one works the same');
                assert.strictEqual(globalThis.appLibOneLoaded, 1, 'app lib one loaded once');
              });

              test("addon depends on an app's module via named import", async function (assert) {
                assert.strictEqual(appLibTwo(), libTwoViaAddon(), 'lib two works the same');
                assert.strictEqual(globalThis.appLibTwoLoaded, 1, 'app lib two loaded once');
              });
            });
          `,
        },
      },
    },
  });

  let v1ExampleAddon = baseAddon();
  v1ExampleAddon.name = 'v1-example-addon';
  v1ExampleAddon.mergeFiles({
    addon: {
      components: {
        'beta.js': `
          import Component from '@glimmer/component';
          export default class extends Component {
            message = "beta";
          }
        `,
        'beta.hbs': `
          <div class="beta">{{this.message}}</div>
          <Gamma />
        `,
        'zeta.hbs': `
          <div class="zeta">Zeta</div>
          <Epsilon />
        `,
      },
    },
    app: {
      'v1-example-addon.js': `
        import appLibOne from './lib/app-lib-one';
        import appLibTwo from 'ts-app-template/lib/app-lib-two';
        export { appLibOne, appLibTwo };
      `,
      templates: {
        components: {
          ...(testNonColocatedTemplates
            ? {
                'delta.hbs': `
                  <div class="delta">delta</div>
                `,
              }
            : {}),
        },
      },
      components: {
        'beta.js': `
          export { default } from 'v1-example-addon/components/beta';
        `,
        'zeta.js': `
          export { default } from 'v1-example-addon/components/zeta';
        `,
      },
    },
  });
  app.addDevDependency(v1ExampleAddon);

  let babelPlugin = app.addDevDependency('babel-plugin-is-a-module', {
    files: {
      'index.mjs': `export default function({ types }) {
        return {
          visitor: {
            StringLiteral(path) {
              if (path.node.value === 'sample-transform-target') {
                path.replaceWith(types.stringLiteral('sample-transform-result'));
              }
            },
          },
        };
      }`,
    },
  });
  babelPlugin.pkg.exports = {
    '.': './index.mjs',
  };
  app.files['babel.config.cjs'] = editBabelConfig(app.files['babel.config.cjs'] as string);
}

function editBabelConfig(src: string): string {
  return src.replace(/babelCompatSupport\(\),/, `babelCompatSupport\(\), 'babel-plugin-is-a-module',`);
}

function runViteInternalsTest(scenario: Scenario, useViteBeta = false) {
  Qmodule(scenario.name, function (hooks) {
    let app: PreparedApp;
    let server: CommandWatcher;
    let appURL: string;

    hooks.before(async () => {
      app = await scenario.prepare();
      if (useViteBeta) {
        await app.execute('pnpm install vite@beta');
      }
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
          .resolves(/\/app\.ts.*/)
          .toModule()
          .resolves(/.*\/-embroider-entrypoint.js/)
          .toModule()
          .withContents((_src, imports) => {
            let pageTitleImports = imports.filter(imp => /page-title/.test(imp.source));
            assert.ok(pageTitleImports.length > 0, 'should have at least one import from page-title');
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
        let result = await app.execute('pnpm testem --file testem-dev.js ci');
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
        result = await app.execute('pnpm ember test --path dist');
        assert.equal(result.exitCode, 0, result.output);
      });
    });
  });
}

// We use LTS 5.12 to exercise our support for non-colocated templates
tsAppScenarios
  .only('lts_5_12')
  .map('vite-internals', app => {
    buildViteInternalsTest(true, app);
  })
  .forEachScenario((scenario: Scenario) => {
    runViteInternalsTest(scenario);
    runViteInternalsTest(scenario, true);
  });

// After 5.12, there is no non-colocated templates in ember.
tsAppScenarios
  .skip('lts_5_12')
  .map('vite-internals', app => {
    buildViteInternalsTest(false, app);
  })
  .forEachScenario(runViteInternalsTest);
