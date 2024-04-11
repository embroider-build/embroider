import { baseAddon, viteAppScenarios } from './scenarios';
import type { PreparedApp } from 'scenario-tester';
import QUnit from 'qunit';
import { exec } from 'child_process';
import { readdirSync } from 'fs-extra';
import { join } from 'path';

const { module: Qmodule, test } = QUnit;

// cannot use util.promisify
// because then qunit will exit early with
// an error about an async hold
function execPromise(command: string): Promise<string> {
  return new Promise(function (resolve, reject) {
    exec(command, (error, stdout) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(stdout.trim());
    });
  });
}

viteAppScenarios
  .map('vite-app-basics', project => {
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
        styles: {
          'my-addon.scss': `
            .my-style {
              color: blue
            }
          `,
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
    project.linkDevDependency('sass', { baseDir: __dirname, resolveName: 'sass' });

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
      tests: {
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
        },
      },
      app: {
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
          'application.module.scss': `@import 'my-addon'`,
          'application.ts': `
            import './application.module.scss';
            import Route from '@ember/routing/route';
            import { service } from '@ember/service';
            export default class extends Route {
              @service store;
              async model() {
                return await this.store.findRecord('post', 1);
              }
            }
          `,
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

      if (process.platform === 'win32') {
        test(`correct windows path`, async function (assert) {
          // windows sometimes generates short path alias 8.3
          // which leads to resolving errors later
          // e.g. cannot find owning engine for C:\Users\runneradmin\AppData\Local\Temp\tmp-2256UvRXnGotcjxi\node_modules\.embroider\rewritten-app
          // the value in engines are:          C:\Users\RUNNER~1\AppData\Local\Temp\tmp-2256UvRXnGotcjxi\node_modules\.embroider\rewritten-app
          // it looks like there is no way to fix this in JS with
          // e.g fs.realpath, resolve, normalize
          // Powershell command can be used, python could also resolve it...
          const command = `powershell.exe -command "(Get-Item -LiteralPath '${app.dir}').FullName"`;
          const dir = await execPromise(command);
          app.dir = dir;
          assert.ok(!dir.includes('~'));
        });
      }

      test(`pnpm test:ember`, async function (assert) {
        // this will only hang if there is an issue
        assert.timeout(5 * 60 * 1000);
        let result = await app.execute('pnpm test:ember');
        assert.equal(result.exitCode, 0, result.output);
        console.log(result.output);
        assert.ok(result.output.includes('should have Yay for gjs!'), 'should have tested');
        assert.ok(result.output.includes(' -- from gjs test file'), 'should have tested with gjs file');
        assert.ok(result.output.includes(' -- from gts test file'), 'should have tested with gts file');
        const depCache = readdirSync(join(app.dir, 'node_modules', '.vite', 'deps'));
        assert.ok(depCache.length > 0, 'should have created cached deps');
      });

      test(`pnpm build`, async function (assert) {
        let result = await app.execute('pnpm build');
        assert.equal(result.exitCode, 0, result.output);
        const distFiles = readdirSync(join(app.dir, 'dist'));
        assert.ok(distFiles.length > 1, 'should have created dist folder');
        assert.ok(distFiles.includes('assets'), 'should have created assets folder');
        assert.ok(distFiles.includes('ember-welcome-page'), 'should have copied addon asset files');
        assert.ok(distFiles.includes('robots.txt'), 'should have copied app assets');

        const assetFiles = readdirSync(join(app.dir, 'dist', 'assets'));
        assert.ok(assetFiles.length > 1, 'should have created asset files');
      });
    });
  });
