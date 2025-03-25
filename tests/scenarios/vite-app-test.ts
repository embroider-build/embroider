import { baseAddon, wideAppScenarios } from './scenarios';
import type { PreparedApp } from 'scenario-tester';
import QUnit from 'qunit';
import { readdirSync, readFileSync, writeFileSync } from 'fs-extra';
import { join, resolve } from 'path';
import CommandWatcher from './helpers/command-watcher';

const { module: Qmodule, test } = QUnit;

// TODO check if we need anything in this test or if things are covered elsewhere
wideAppScenarios
  .map('vite-app-basics', project => {
    // These are for a custom testem setup that will let us do runtime tests
    // inside `vite dev` rather than only against the output of `vite build`.
    //
    // Most apps should run their CI against `vite build`, as that's closer to
    // production. And they can do development tests directly in brower against
    // `vite dev` at `/tests/index.html`. We're doing `vite dev` in CI here
    // because we're testing the development experience itself.
    project.linkDevDependency('testem', { baseDir: __dirname });
    project.linkDevDependency('@embroider/test-support', { baseDir: __dirname });

    let addon = baseAddon();
    addon.pkg.name = 'my-addon';
    // setup addon that triggers packages/compat/src/hbs-to-js-broccoli-plugin.ts
    addon.mergeFiles({
      'index.js': `
        module.exports = {
          name: 'my-addon',
          setupPreprocessorRegistry(type, registry) {
              // we want custom ast transforms for own addon
              if (type === 'parent') {
                return;
              }
              const plugin = this._buildPlugin();
              plugin.parallelBabel = {
                requireFile: __filename,
                buildUsing: '_buildPlugin',
                params: {},
              };

              registry.add('htmlbars-ast-plugin', plugin);
            },

            _buildPlugin(options) {
              return {
                name: 'test-transform',
                plugin: () => {
                  return {
                    name: "test-transform",
                    visitor: {
                      Template() {}
                    },
                  };
                },
                baseDir() {
                  return __dirname;
                },
              };
            },
        }
      `,
      app: {
        components: {
          'component-one.js': `export { default } from 'my-addon/components/component-one';`,
        },
      },
      addon: {
        components: {
          'component-one.js': `
          import Component from '@glimmer/component';
          export default class ComponentOne extends Component {}
        `,
          'component-one.hbs': `component one template`,
        },
      },
    });

    project.addDevDependency(addon);

    let addon2 = baseAddon();
    addon2.pkg.name = 'my-addon2';
    addon2.mergeFiles({
      app: {
        components: {
          'component-two.js': `export { default } from 'my-addon2/components/component-two';`,
        },
      },
      addon: {
        components: {
          'component-two.hbs': `component two template: "{{this}}"`,
        },
      },
    });

    project.addDevDependency(addon2);
    project.mergeFiles({
      'testem-dev.js': `
          'use strict';

          module.exports = {
            test_page: '/tests?hidepassed',
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
              require('@embroider/test-support/testem-proxy').testemProxy('http://localhost:4200', '/')
            ],
          };
        `,
      tests: {
        acceptance: {
          'app-route-test.js': `import { module, test } from 'qunit';
          import { visit } from '@ember/test-helpers';
          import { setupApplicationTest } from 'app-template/tests/helpers';

          module('Acceptance | app route', function (hooks) {
            setupApplicationTest(hooks);

            test('visiting /', async function (assert) {
              await visit('/');
              assert.dom().includesText('hey');
            });
          });
          `,
        },
        integration: {
          'test-colocated-addon-component.js': `
            import { module, test } from 'qunit';
            import { setupRenderingTest } from 'ember-qunit';
            import { render, rerender } from '@ember/test-helpers';
            import { hbs } from 'ember-cli-htmlbars';

            module('Integration | Component | component one template from addon', (hooks) => {
              setupRenderingTest(hooks);

              test('should have component one template from addon', async function (assert) {
                await render(hbs\`
                <ComponentOne></ComponentOne>
                <ComponentTwo />
                \`);
                await rerender();
                assert.dom().includesText('component one template');
                assert.dom().includesText('component two template: ""');
                assert.dom().doesNotIncludeText('export default precompileTemplate');
              });
            });

          `,
          'example-test.js': `import { module, test } from 'qunit';
          import { setupRenderingTest } from 'ember-qunit';
          import { render, rerender } from '@ember/test-helpers';
          import { hbs } from 'ember-cli-htmlbars';

          module('Integration | Component | Example', (hooks) => {
            setupRenderingTest(hooks);

            test('should have Yay for gts!', async function (assert) {
              await render(hbs\`
              <Example></Example>
              \`);
              await rerender();
              assert.dom().includesText('Yay for gts!');
            });
          });
          `,
          'fany-test-gjs.gjs': `import { module, test } from 'qunit';
          import { setupRenderingTest } from 'ember-qunit';
          import { render, click, rerender, settled } from '@ember/test-helpers';
          import Fancy from 'app-template/components/fancy2';


          module('Integration | Component | Fany -- from gjs test file', (hooks) => {
            setupRenderingTest(hooks);

            test('should have Yay for gts!', async function(assert) {
              await render(<template>
            <Fancy @type="primary2"></Fancy>
          </template>);
              await rerender()

              assert.dom().hasText('Yay for gjs!');
            });
          });
          `,
          'fany-test.gts': `import { module, test } from 'qunit';
          import { setupRenderingTest } from 'ember-qunit';
          import { render, rerender } from '@ember/test-helpers';
          import Fancy from 'app-template/components/fancy';


          module('Integration | Component | Fany -- from gts test file', (hooks) => {
            setupRenderingTest(hooks);

            test('should have Yay for gts!', async function(assert) {
              await render(<template>
            <Fancy @type="primary2"></Fancy>
          </template>);
              await rerender()

              assert.dom().hasText('Yay for gts!');
            });
          });
          `,
          'fany2-test.js': `import { module, test } from 'qunit';
          import { setupRenderingTest } from 'ember-qunit';
          import { render, rerender } from '@ember/test-helpers';
          import { hbs } from 'ember-cli-htmlbars';

          module('Integration | Component | Fany2', (hooks) => {
            setupRenderingTest(hooks);

            test('should have Yay for gjs!', async function (assert) {
              await render(hbs\`
              <Fancy @type="primary2"></Fancy>
              <Fancy2 @type="primary2"></Fancy2>
              \`);
              await rerender();

              assert.dom().includesText('Yay for gts!');
              assert.dom().includesText('Yay for gjs!');
            });
          });
          `,
        },
      },
      app: {
        components: {
          old: {
            'component.js': `import Component from '@glimmer/component';

            export default class extends Component {
              message = 'hi';
            }
            `,
            'component.hbs': `<div>hey {{@message}} <Fancy /></div>`,
          },
          'example.hbs': `<div>hey {{@message}} <Fancy /></div>`,
          'example.js': `import Component from '@glimmer/component';
          import Fancy from './fancy';

          export default class extends Component {
            message = 'hi';
            Fancy = Fancy;
          }`,
          'fancy.gts': `<template>Yay for gts!</template>`,
          'fancy2.gjs': `<template>Yay for gjs!</template>`,
        },
        adapters: {
          'post.js': `
            import JSONAPIAdapter from '@ember-data/adapter/json-api';
            export default class extends JSONAPIAdapter {
              urlForFindRecord(/* id, modelName */) {
                return \`\${super.urlForFindRecord(...arguments)}.json\`;
              }
            }
          `,
        },
        models: {
          'post.js': `
            import Model, { attr } from '@ember-data/model';
            export default class extends Model {
              @attr message;
            }
          `,
        },
        routes: {
          'application.js': `
            import Route from '@ember/routing/route';
            import { inject as service } from '@ember/service';
            export default class extends Route {
              @service store;
              async model() {
                return await this.store.findRecord('post', 1);
              }
            }
          `,
        },
        templates: {
          'application.hbs': `{{page-title "ViteApp"}}

          <Example @message={{this.model.message}} />
          <Old @message={{this.model.message}} />

          {{outlet}}`,
        },
      },
      public: {
        posts: {
          '1.json': JSON.stringify(
            {
              data: {
                type: 'post',
                id: '1',
                attributes: {
                  message: 'From Ember Data',
                },
              },
            },
            null,
            2
          ),
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

      test(`pnpm test:ember`, async function (assert) {
        // this will only hang if there is an issue
        assert.timeout(5 * 60 * 1000);
        let result = await app.execute('pnpm test:ember');
        assert.equal(result.exitCode, 0, result.output);
        console.log(result.output);
        assert.ok(result.output.includes('should have Yay for gjs!'), 'should have tested');
        assert.ok(result.output.includes(' -- from gjs test file'), 'should have tested with gjs file');
        assert.ok(result.output.includes(' -- from gts test file'), 'should have tested with gts file');
      });

      test(`pnpm build`, async function (assert) {
        let result = await app.execute('pnpm build');
        assert.equal(result.exitCode, 0, result.output);
        const distFiles = readdirSync(join(app.dir, 'dist'));
        assert.ok(distFiles.length > 1, 'should have created dist folder');
        assert.ok(distFiles.includes('assets'), 'should have created assets folder');
        assert.ok(distFiles.includes('robots.txt'), 'should have copied app assets');

        const assetFiles = readdirSync(join(app.dir, 'dist', '@embroider', 'virtual'));
        assert.ok(assetFiles.length > 1, 'should have created asset files');
      });

      Qmodule('vite dev', function (hooks) {
        let server: CommandWatcher;

        hooks.before(async () => {
          server = CommandWatcher.launch('vite', ['--clearScreen', 'false'], { cwd: app.dir });
          const [, appURL] = await server.waitFor(/Local:\s+(https?:\/\/.*)\//g);

          let testem = readFileSync(resolve(app.dir, 'testem-dev.js')).toString();
          testem = testem.replace(`.testemProxy('http://localhost:4200', '/')`, `.testemProxy('${appURL}', '/')`);
          writeFileSync(resolve(app.dir, 'testem-dev.js'), testem);
        });

        hooks.after(async () => {
          await server?.shutdown();
        });

        test('run test suite against vite dev', async function (assert) {
          let result = await app.execute('pnpm testem --file testem-dev.js ci');
          assert.equal(result.exitCode, 0, result.output);
        });
      });
    });
  });
