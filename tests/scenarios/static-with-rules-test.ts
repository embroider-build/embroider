import type { Options } from '@embroider/compat';
import type { PreparedApp } from 'scenario-tester';
import { appScenarios, baseAddon, renameApp } from './scenarios';
import { throwOnWarnings } from '@embroider/core';
import QUnit from 'qunit';

const { module: Qmodule, test } = QUnit;

appScenarios
  // last release that supports non-colocated templates (which is part of what
  // this test is testing)
  .only('lts_5_12')
  .map('static-with-rules', app => {
    renameApp(app, 'my-app');

    let options: Options = {
      staticAppPaths: ['static-dir', 'top-level-static.js'],
      packageRules: [
        {
          package: 'my-addon',
          components: {
            '{{hello-world}}': {
              acceptsComponentArguments: [
                {
                  name: 'useDynamic',
                  becomes: 'dynamicComponentName',
                },
              ],
              layout: {
                addonPath: 'templates/components/hello-world.hbs',
              },
            },
          },
          addonModules: {
            'components/hello-world.js': {
              dependsOnModules: ['../synthetic-import-1'],
              dependsOnComponents: ['{{second-choice}}'],
            },
          },
          addonTemplates: {
            'templates/components/addon-tree-invoke-example.hbs': {
              invokes: {
                'this.stuff': ['<FirstDynamicallyInvoked />'],
              },
            },
          },
          appModules: {
            'components/hello-world.js': {
              dependsOnModules: ['my-addon/synthetic-import-2'],
            },
          },
          appTemplates: {
            'templates/components/app-tree-invoke-example.hbs': {
              invokes: {
                'this.stuff': ['<SecondDynamicallyInvoked />'],
              },
            },
          },
        },
      ],
    };

    app.mergeFiles({
      'ember-cli-build.js': `
        'use strict';
        const EmberApp = require('ember-cli/lib/broccoli/ember-app');
        const { maybeEmbroider } = require('@embroider/test-setup');

        module.exports = function (defaults) {
          let app = new EmberApp(defaults, {});
          return maybeEmbroider(app, ${JSON.stringify(options, null, 2)});
        };
        `,
      app: {
        'router.js': `
          import EmberRouter from '@ember/routing/router';
          import config from 'my-app/config/environment';

          export default class Router extends EmberRouter {
            location = config.locationType;
            rootURL = config.rootURL;
          }

          Router.map(function () {
            this.route('curly')
            this.route('invokes');
          });
        `,
        templates: {
          'index.hbs': `
            <HelloWorld class="hello-first" @useDynamic="first-choice" />
            <HelloWorld class="hello-second" @useDynamic={{"second-choice"}} />
            <HelloWorld class="hello-third" @useDynamic={{component "third-choice"}} />
          `,
          'curly.hbs': `
            <div class='hello-first'>{{hello-world useDynamic="first-choice" }}</div>
            <div class='hello-third'>{{hello-world useDynamic=(component "third-choice") }}</div>
          `,
          'invokes.hbs': `
            <div class="addon-example"><AddonTreeInvokeExample /></div>
            <div class="app-example"><AppTreeInvokeExample /></div>
          `,
          components: {
            'first-choice.hbs': 'first',
            'second-choice.hbs': 'second',
            'third-choice.hbs': 'third',
            'module-name-check': {
              'index.hbs': '<div class={{embroider-sample-transforms-module}}>hello world</div>',
            },
          },
        },
        components: {
          'uses-inline-template.js': `
          import hbs from "htmlbars-inline-precompile";
          import Component from '@ember/component';
          export default Component.extend({
            layout: hbs${'`'}<FirstChoice/>${'`'}
          })
          `,
        },
        'custom-babel-needed.js': `console.log('embroider-sample-transforms-target');`,
        helpers: {
          'embroider-sample-transforms-module.js': 'export default function() {}',
        },
        'static-dir': {
          'my-library.js': `
            globalThis.staticDirMyLibLoaded = true;
            export {}
          `,
        },
        'static-dir-not-really': {
          'something.js': `
            globalThis.notReallyStaticLoaded = true;
            export {}
          `,
        },
        'non-static-dir': {
          'another-library.js': `
            globalThis.anotherLibraryLoaded = true;
            export {}
          `,
        },
        'top-level-static.js': `
           globalThis.topLevelStaticLoaded = true;
           export {}
         `,
      },
      public: {
        'public-file-1.txt': `initial state`,
      },
      tests: {
        unit: {
          'basics-test.js': `
            import { module, test } from 'qunit';
            import { setupApplicationTest } from 'ember-qunit';
            import { visit } from '@ember/test-helpers';

            module('acceptance: basics', function(hooks) {
              setupApplicationTest(hooks);

              test('dynamic component argument rule worked', async function(assert) {
                await visit('/');
                assert.dom('.hello-first').containsText('first');
                assert.dom('.hello-second').containsText('second');
                assert.dom('.hello-third').containsText('third');
              })

              test('dynamic component argument rule in curlies', async function(assert) {
                await visit('/curly');
                assert.dom('.hello-first').containsText('first');
                assert.dom('.hello-third').containsText('third');
              })

              test('dependsOnModules rule in addon tree', async function(assert) {
                await visit('/');
                assert.ok(globalThis.syntheticImport1Loaded, 'checking synthetic import 1');
              });

              test('dependsOnModules rule in app tree', async function(assert) {
                await visit('/');
                assert.ok(globalThis.syntheticImport2Loaded, 'checking synthetic import 2');
              });

              test('non-static-dir loaded', async function(assert) {
                assert.ok(globalThis.anotherLibraryLoaded, 'checking anotherLibraryLoaded');
              });

              test('non-static-dir with prefix the same as a static-dir loaded', async function(assert) {
                assert.ok(globalThis.notReallyStaticLoaded, 'checking notReallyStaticLoaded');
              });

              test('static-dir not loaded', async function(assert) {
                assert.ok(!globalThis.staticDirMyLibLoaded, 'checking staticDirMyLibLoaded');
              });

              test('top level static not loaded', async function(assert) {
                assert.ok(!globalThis.topLevelStaticLoaded, 'checking topLevelStaticLoaded');
              });

              test('invokes rule in addon tree', async function(assert) {
                await visit('/invokes');
                assert.dom('.addon-example').containsText('first dynamically invoked')
              })

              test('invokes rule in app tree', async function(assert) {
                await visit('/invokes');
                assert.dom('.app-example').containsText('second dynamically invoked')
              })
            })
          `,
        },
      },
    });

    let addon = baseAddon();
    addon.pkg.name = 'my-addon';
    app.addDependency(addon);

    addon.mergeFiles({
      addon: {
        components: {
          'hello-world.js': `
             import Component from '@ember/component';
             import layout from '../templates/components/hello-world';
             export default class extends Component {
               get dynamicComponentName() {
                 return this.useDynamic || 'default-dynamic';
               }
               layout = layout;
             }
          `,
          'addon-tree-invoke-example.js': `
             import Component from '@ember/component';
             import layout from '../templates/components/addon-tree-invoke-example.hbs';
             export default class extends Component {
               get stuff() {
                 return 'first-dynamically-invoked';
               }
               layout = layout;
             }
          `,
          'app-tree-invoke-example.js': `
            import Component from '@ember/component';
            export default class extends Component {
              get stuff() {
                return 'second-dynamically-invoked';
              }
            }
          `,
          'first-dynamically-invoked.js': `
            import Component from '@glimmer/component';
            import { template } from '@ember/template-compiler'
            export default template("first dynamically invoked");
          `,
          'second-dynamically-invoked.js': `
            import Component from '@glimmer/component';
            import { template } from '@ember/template-compiler'
            export default template("second dynamically invoked");
          `,
        },
        'synthetic-import-1.js': `
          globalThis.syntheticImport1Loaded = true;
          export {}
        `,
        'synthetic-import-2.js': `
          globalThis.syntheticImport2Loaded = true;
          export {}
        `,
        templates: {
          components: {
            'hello-world.hbs': `
              <div ...attributes>{{component this.dynamicComponentName}}</div>
            `,
            'addon-tree-invoke-example.hbs': '{{component this.stuff}}',
          },
        },
      },
      app: {
        components: {
          'hello-world.js': `export { default } from 'my-addon/components/hello-world'`,
          'addon-tree-invoke-example.js': `export { default } from 'my-addon/components/addon-tree-invoke-example'`,
          'app-tree-invoke-example.js': `export { default } from 'my-addon/components/app-tree-invoke-example'`,
          'first-dynamically-invoked.js': `export { default } from 'my-addon/components/first-dynamically-invoked'`,
          'second-dynamically-invoked.js': `export { default } from 'my-addon/components/second-dynamically-invoked'`,
        },
        templates: {
          components: {
            'app-tree-invoke-example.hbs': `{{component this.stuff}}`,
          },
        },
      },
      public: {
        'package.json': JSON.stringify({ customStuff: { fromMyAddon: true }, name: 'should-be-overridden' }),
      },
    });
  })
  .forEachScenario(scenario => {
    Qmodule(scenario.name, function (hooks) {
      throwOnWarnings(hooks);

      let app: PreparedApp;

      hooks.before(async () => {
        app = await scenario.prepare();
      });

      test('pnpm test', async function (assert) {
        let result = await app.execute('pnpm test');
        assert.equal(result.exitCode, 0, result.output);
      });
    });
  });
