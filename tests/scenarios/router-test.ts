import { tsAppScenarios } from './scenarios';
import type { PreparedApp } from 'scenario-tester';
import QUnit from 'qunit';
import { merge } from 'lodash';

const { module: Qmodule, test } = QUnit;

let routerApp = tsAppScenarios.map('router', project => {
  project.linkDevDependency('@embroider/router', { baseDir: __dirname });

  // not strictly needed in the embroider case, but needed in the classic
  // case.
  project.linkDevDependency('@embroider/macros', { baseDir: __dirname });

  merge(project.files, {
    'ember-cli-build.js': `
        'use strict';

        const EmberApp = require('ember-cli/lib/broccoli/ember-app');
        const { maybeEmbroider } = require('@embroider/test-setup');
        
        module.exports = function (defaults) {
          let app = new EmberApp(defaults, {
            'ember-cli-babel': {
              enableTypeScriptTransform: true,
            },
            '@embroider/macros': {
              setOwnConfig: {
                expectClassic: process.env.EMBROIDER_TEST_SETUP_FORCE === 'classic'
              }
            }
          });
        
          return maybeEmbroider(app, {
            staticAddonTestSupportTrees: true,
            staticAddonTrees: true,
            staticInvokables: true,
            splitAtRoutes: ['split-me'],
            skipBabel: [
              {
                package: 'qunit',
              },
            ],
          });
        };
      `,
    app: {
      components: {
        'used-in-child.hbs': `
            <div data-test-used-in-child>This is the used-in-child component</div>
          `,
      },
      controllers: {
        'split-me.ts': `
            import Controller from '@ember/controller';
            export default class SplitMeController extends Controller {}
          `,
        'split-me': {
          'child.ts': `
              import Controller from '@ember/controller';
              export default class SplitMeChildController extends Controller {}
            `,
        },
      },
      routes: {
        'split-me.ts': `
            import Route from '@ember/routing/route';
            export default class SplitMeRoute extends Route {}
          `,
        'split-me': {
          'child.ts': `
              import Route from '@ember/routing/route';
              export default class SplitMeChildRoute extends Route {}
            `,
          'index.ts': `
              import Route from '@ember/routing/route';
              export default class SplitMeIndexRoute extends Route {}
            `,
        },
      },
      templates: {
        'application.hbs': `
            {{page-title 'Router Tests'}}

            <h2 id='title'>Welcome to Ember</h2>

            <LinkTo @route='index'>Index</LinkTo>
            <LinkTo @route='split-me'>Split Index</LinkTo>
            <LinkTo @route='split-me.child'>Split Child</LinkTo>

            {{outlet}}
          `,
        'split-me.hbs': `{{outlet}}`,
        'split-me': {
          'child.hbs': `<UsedInChild />`,
          'index.hbs': `<div data-test-split-me-index>This is the split-me/index.</div>`,
        },
      },
      'router.ts': `
          import EmberRouter from '@embroider/router';
          import config from 'ts-app-template/config/environment';

          export default class Router extends EmberRouter {
            location = config.locationType;
            rootURL = config.rootURL;
          }

          Router.map(function () {
            this.route('split-me', function () {
              this.route('child');
            });
          });
        `,
    },
    tests: {
      acceptance: {
        'lazy-routes-test.ts': `

          import { module, test } from 'qunit';
          import { visit } from '@ember/test-helpers';
          import { setupApplicationTest } from 'ember-qunit';
          import ENV from 'ts-app-template/config/environment';
          import { getGlobalConfig, getOwnConfig } from '@embroider/macros';

          /* global requirejs */

          module('Acceptance | lazy routes', function (hooks) {
            setupApplicationTest(hooks);

            function hasController(routeName: string) {
              return Boolean(
                (requirejs as any).entries[\`\${ENV.modulePrefix}/controllers/\${routeName}\`]
              );
            }

            function hasRoute(routeName: string) {
              return Boolean(
                (requirejs as any).entries[\`\${ENV.modulePrefix}/routes/\${routeName}\`]
              );
            }

            function hasTemplate(routeName: string) {
              return Boolean(
                (requirejs as any).entries[\`\${ENV.modulePrefix}/templates/\${routeName}\`]
              );
            }

            function hasComponent(name: string) {
              return Boolean((requirejs as any).entries[\`\${ENV.modulePrefix}/components/\${name}\`]);
            }

            if (getOwnConfig<{ expectClassic: boolean }>().expectClassic) {
              test('lazy routes present', async function (assert) {
                await visit('/');
                assert.ok(hasController('split-me'), 'classic build has controller');
                assert.ok(hasRoute('split-me'), 'classic build has route');
                assert.ok(hasTemplate('split-me'), 'classic build has template');
                assert.ok(
                  hasController('split-me/child'),
                  'classic build has child controller'
                );
                assert.ok(hasRoute('split-me/child'), 'classic build has child route');
                assert.ok(
                  hasTemplate('split-me/child'),
                  'classic build has child template'
                );
                assert.ok(
                  hasComponent('used-in-child'),
                  'classic build has all components'
                );
              });
            } else {
              test('lazy routes not yet present', async function (assert) {
                await visit('/');
                assert.notOk(hasController('split-me'), 'controller is lazy');
                assert.notOk(hasRoute('split-me'), 'route is lazy');
                assert.notOk(hasTemplate('split-me'), 'template is lazy');
                assert.notOk(hasController('split-me/child'), 'child controller is lazy');
                assert.notOk(hasRoute('split-me/child'), 'child route is lazy');
                assert.notOk(hasTemplate('split-me/child'), 'child template is lazy');
                assert.notOk(
                  hasComponent('used-in-child'),
                  'descendant components are lazy'
                );
              });
            }

            if (getOwnConfig<{ expectClassic: boolean }>().expectClassic) {
              test('classic builds can not see @embroider/core config', async function (assert) {
                let config = getGlobalConfig<{ '@embroider/core'?: { active: true} }>()['@embroider/core'];
                assert.strictEqual(
                  config,
                  undefined,
                  'expected no embroider core config'
                );
              });
            } else {
              test('can see @embroider/core config', async function (assert) {
                let config = getGlobalConfig<{ '@embroider/core'?: { active: true} }>()['@embroider/core'];
                assert.true(config!.active, 'expected to see active @embroider/core');
              });
            }

            test('can enter a lazy route', async function (assert) {
              await visit('/split-me');
              assert.ok(
                document.querySelector('[data-test-split-me-index]'),
                'split-me/index rendered'
              );
            });

            test('can enter a child of a lazy route', async function (assert) {
              await visit('/split-me/child');
              assert.ok(
                document.querySelector('[data-test-used-in-child]'),
                'split-me/child rendered'
              );
            });
          });
                  
          `,
      },
    },
  });
});

routerApp.forEachScenario(scenario => {
  Qmodule(scenario.name, function (hooks) {
    let app: PreparedApp;
    hooks.before(async () => {
      app = await scenario.prepare();
    });

    test(`type checks`, async function (assert) {
      let result = await app.execute('pnpm tsc');
      assert.equal(result.exitCode, 0, result.output);
    });
  });
});

routerApp.forEachScenario(scenario => {
  Qmodule(scenario.name, function (hooks) {
    let app: PreparedApp;
    hooks.before(async () => {
      app = await scenario.prepare();
    });

    test(`CLASSIC pnpm test:ember`, async function (assert) {
      let result = await app.execute('pnpm test:ember', {
        env: {
          EMBROIDER_TEST_SETUP_FORCE: 'classic',
        },
      });
      assert.equal(result.exitCode, 0, result.output);
    });

    test(`EMBROIDER pnpm test:ember`, async function (assert) {
      let result = await app.execute('pnpm test:ember', {
        env: {
          EMBROIDER_TEST_SETUP_FORCE: 'embroider',
          EMBROIDER_TEST_SETUP_OPTIONS: 'optimized',
        },
      });
      assert.equal(result.exitCode, 0, result.output);
    });
  });
});
