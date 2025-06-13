import { wideAppScenarios, baseAddon } from './scenarios';
import type { PreparedApp } from 'scenario-tester';
import { Project } from 'scenario-tester';
import QUnit from 'qunit';
import merge from 'lodash/merge';
import { dirname } from 'path';
const { module: Qmodule, test } = QUnit;

// this test is being used as a "smoke test" to check the widest possible support matrix
wideAppScenarios
  .map('static-app', project => {
    project.linkDevDependency('bootstrap', { baseDir: __dirname });
    project.addDevDependency(emberBootstrap());
    project.linkDevDependency('@babel/helper-module-imports', { baseDir: __dirname });
    project.linkDevDependency('@embroider/macros', { baseDir: __dirname });
    project.linkDevDependency('ember-modifier', { baseDir: __dirname });

    let myHelpersAddon = baseAddon();
    myHelpersAddon.pkg.name = 'my-helpers-addon';
    myHelpersAddon.mergeFiles({
      app: {
        helpers: {
          'reverse.js': `export { default } from 'my-helpers-addon/helpers/reverse'`,
          'intersect.js': `export { default } from 'my-helpers-addon/helpers/intersect'`,
        },
      },
      addon: {
        helpers: {
          'reverse.js': `
            import { helper } from '@ember/component/helper';
            import { A as emberArray, isArray as isEmberArray } from '@ember/array';

            export function reverse([array]) {
              if (!isEmberArray(array)) {
                return [array];
              }

              return emberArray(array).slice(0).reverse();
            }

            export default helper(reverse);
          `,
          'intersect.js': `
            import { helper } from '@ember/component/helper';
            import { isArray as isEmberArray } from '@ember/array';

            export function intersect([...arrays]) {
              let confirmedArrays = arrays.map(array => {
                return isEmberArray(array) ? array : [];
              });
              let results = confirmedArrays.pop().filter(candidate => {
                for (let i = 0; i < confirmedArrays.length; i++) {
                  let found = false;
                  let array = confirmedArrays[i];
                  for (let j = 0; j < array.length; j++) {
                    if (array[j] === candidate) {
                      found = true;
                      break;
                    }
                  }

                  if (found === false) {
                    return false;
                  }
                }

                return true;
              });

              return results;
            }

            export default helper(intersect);
          `,
        },
      },
    });
    project.addDevDependency(myHelpersAddon);

    merge(project.files, {
      app: {
        adapters: {
          'post.js': `
            import JSONAPIAdapter from '@ember-data/adapter/json-api';
            export default class PostAdapter extends JSONAPIAdapter {
              findRecord(store, type, id, snapshot) {
                return { data: { type: 'posts', id: '0', attributes: { title: 'Hello world' } } };
              }
            }
          `,
        },
        components: {
          'fancy-box.js': `
            import Component from '@glimmer/component';
            import DefaultTitle from './default-title';

            export default class FancyBox extends Component {
              get titleComponentWithDefault() {
                return this.args.titleComponent || DefaultTitle;
              }
            }
          `,
          'fancy-box.hbs': `
          {{component this.titleComponentWithDefault title=@title}}
          `,
          'default-title.hbs': `
            <div data-example="default" class="the-default-title-component">{{@title}}</div>
          `,
          'my-title.hbs': `
            <div data-example="customized" class="my-title-component">{{@title}}</div>
          `,
        },
        models: {
          'post.js': `
            import Model, { attr } from '@ember-data/model';
            export default class PostModel extends Model {
              @attr() title;
            }
          `,
        },
        modifiers: {
          'example-modifier.js': `
            import { modifier } from 'ember-modifier';
            export default modifier(function example(element/*, positional, named*/) {
              element.setAttribute('data-it-worked', true);
            });
          `,
        },
        routes: {
          'ember-data-example.js': `
            import Route from '@ember/routing/route';
            import { inject as service } from '@ember/service';

            export default class EmberDataExampleRoute extends Route {
              @service() store;
              model() {
                return this.store.findRecord('post', 0);
              }
            }
          `,
        },
        serializers: {
          'application.js': `
            import JSONAPISerializer from '@ember-data/serializer/json-api';
            export default class extends JSONAPISerializer {};
          `,
        },
        services: {
          'debug.js': `
            import Service from '@ember/service';
            import { assert, deprecate, runInDebug } from '@ember/debug';
            import { DEBUG } from '@glimmer/env';

            export default class extends Service {
              isDebug() {
                return DEBUG;
              }
              assert(desc, test) {
                assert(desc, test);
              }
              deprecate(message, test, { id, until, since, for: source }) {
                deprecate(message, test, { id, until, since, for: source });
              }
              runInDebug(func) {
                runInDebug(func);
              }
            };
          `,
        },
        templates: {
          'components-example.hbs': `
            {{! this uses a component from ember-bootstrap }}
            <BsButton>Button</BsButton>
          `,
          'helpers-example.hbs': `
            {{! this uses reverse helpers from my-helpers-addon }}
            {{#each (reverse (array "alpha" "beta")) as |word| }}
              <div data-word={{word}}>{{word}}</div>
            {{/each}}
          `,
          'static-component-rules-example.hbs': `
            <FancyBox @title="With Default" />
            <FancyBox @title="With Custom" @titleComponent="my-title" />
          `,
          'ember-data-example.hbs': `<h1>{{@model.title}}</h1>`,
        },
        'router.js': `
          import EmberRouter from '@ember/routing/router';
          import config from 'app-template/config/environment';

          export default class Router extends EmberRouter {
            location = config.locationType;
            rootURL = config.rootURL;
          }

          Router.map(function() {
            this.route('helpers-example');
            this.route('components-example');
            this.route('static-component-rules-example');
            this.route('macros-example');
            this.route('ember-data-example');
          });
        `,
      },
      tests: {
        acceptance: {
          'components-example-test.js': `
            import { module, test } from 'qunit';
            import { visit } from '@ember/test-helpers';
            import { setupApplicationTest } from '../helpers';

            module('Acceptance | components-example', function (hooks) {
              setupApplicationTest(hooks);

              test('static components', async function (assert) {
                await visit('/components-example');

                let button = document.querySelector('.btn');
                assert.ok(button, 'found ember-bootstrap button');
                if (button) {
                  assert.equal(
                    getComputedStyle(button)['background-color'],
                    'rgb(108, 117, 125)',
                    'bs-button has its CSS'
                  );
                }

                assert.containerDoesNotHave(
                  'component:bs-button',
                  'expected not to find bs-button because it got inserted via lexical scope'
                );
                assert.containerDoesNotHave(
                  'component:bs-carousel',
                  'expected not to find bs-carousel in embroider build'
                );
              });
            });

          `,
          'helpers-example-test.js': `
            import { module, test } from 'qunit';
            import { visit } from '@ember/test-helpers';
            import { setupApplicationTest } from '../helpers';

            module('Acceptance | helpers-example', function (hooks) {
              setupApplicationTest(hooks);

              test('static helpers', async function (assert) {
                await visit('/helpers-example');

                assert.deepEqual(
                  [...document.querySelectorAll('[data-word]')].map(
                    (elt) => elt.dataset.word
                  ),
                  ['beta', 'alpha'],
                  'array and reverse worked'
                );

                assert.containerDoesNotHave(
                  'helper:reverse',
                  'expected not to find reverse because its provided directly via scope'
                );
                assert.containerDoesNotHave(
                  'helper:intersect',
                  'expected not to find unused helper intersect'
                );
              });
            });
          `,
          'static-component-rules-example-test.js': `
            import { module, test } from 'qunit';
            import { visit, currentURL } from '@ember/test-helpers';
            import { setupApplicationTest } from 'ember-qunit';

            module('Acceptance | static component rules example', function(hooks) {
              setupApplicationTest(hooks);

              test('visiting /static-component-rules-example', async function(assert) {
                await visit('/static-component-rules-example');
                assert.equal(currentURL(), '/static-component-rules-example');
                assert.ok(document.querySelector('[data-example="default"].the-default-title-component'), 'default exists');
                assert.ok(document.querySelector('[data-example="customized"].my-title-component'), 'customized exists');
              });
            });
          `,
          'ember-data-example-test.js': `
            import { module, test } from 'qunit';
            import { visit, currentURL } from '@ember/test-helpers';
            import { setupApplicationTest } from 'ember-qunit';

            module('Acceptance | ember data example', function (hooks) {
              setupApplicationTest(hooks);

              test('visiting /ember-data-example', async function (assert) {
                await visit('/ember-data-example');
                assert.equal(currentURL(), '/ember-data-example');
                assert.dom('h1').containsText('Hello world');
              });
            });
          `,
        },
        integration: {
          components: {
            'modifiers-example-test.js': `
              import { module, test } from 'qunit';
              import { setupRenderingTest } from 'app-template/tests/helpers';
              import { render } from '@ember/test-helpers';
              import { hbs } from 'ember-cli-htmlbars';

              module('Integration | modifier | example-modifier', function (hooks) {
                setupRenderingTest(hooks);

                test('it renders', async function (assert) {
                  await render(hbs('<div data-target {{example-modifier}} />'));
                  assert.dom('[data-target]').hasAttribute('data-it-worked');
                });
              });`,
          },
        },
        unit: {
          services: {
            'debug-test.js': `
              import { module, test } from 'qunit';
              import { setupTest } from '../../helpers';
              import { registerDeprecationHandler } from '@ember/debug';

              // https://vite.dev/guide/env-and-mode.html#built-in-constants
              const isProduction = 'production' === import.meta.env.MODE;

              module('Unit | Service | debug', function(hooks) {
                setupTest(hooks);

                test('DEBUG only in development', function(assert) {
                  const service = this.owner.lookup('service:debug');
                  assert.strictEqual(!isProduction, service.isDebug(), 'service.isDebug');
                  assert.strictEqual(isProduction, service.isDebug.toString().endsWith('){return!1}'), 'service.isDebug is optimized');
                });

                test('asserts only in development', function(assert) {
                  const service = this.owner.lookup('service:debug');
                  const doAssert = () => service.assert('debug-test assertion', false);
                  if (isProduction) {
                    doAssert();
                    assert.ok(true, 'assert ignored');
                  } else {
                    assert.throws(doAssert, /Assertion Failed: debug-test assertion/, 'service.assert throws');
                    assert.strictEqual(isProduction, service.assert.toString().endsWith('){}'), 'service.assert is empty');
                  }
                });

                test('runInDebug only in development', function(assert) {
                  const service = this.owner.lookup('service:debug');
                  const DID_NOT_RUN = 'runInDebug did NOT run';
                  const DID_RUN = 'runInDebug DID run';

                  let result = DID_NOT_RUN;
                  service.runInDebug(() => result = DID_RUN);
                  assert.strictEqual(result, isProduction ? DID_NOT_RUN : DID_RUN, 'service.runInDebug');
                  assert.strictEqual(isProduction, service.runInDebug.toString().endsWith('){}'), 'service.runInDebug is empty');
                });

                test('deprecate only in development', function(assert) {
                  const service = this.owner.lookup('service:debug');
                  const DEPRECATION_FOR = 'unit/services/debug-test';

                  const deprecations = [];
                  registerDeprecationHandler((message, options, next) => {
                    if (options.for === DEPRECATION_FOR) {
                      deprecations.push(message, options);
                    } else {
                      next(message, options);
                    }
                  });

                  const message = 'debug-test deprecation';
                  const options = { id: 'debug-test-deprecation', until: '999999.0.0', since: '3.28', for: DEPRECATION_FOR };
                  service.deprecate(message, false, options);
                  assert.deepEqual(deprecations, isProduction ? [] : [ message, options ], 'service.deprecate');
                  assert.strictEqual(isProduction, service.deprecate.toString().endsWith('){}'), 'service.deprecate is empty');
                });
              });
            `,
          },
        },
        helpers: {
          'index.js': `
            import {
              setupApplicationTest as upstreamSetupApplicationTest,
              setupRenderingTest as upstreamSetupRenderingTest,
              setupTest as upstreamSetupTest,
            } from 'ember-qunit';

            // This file exists to provide wrappers around ember-qunit's / ember-mocha's
            // test setup functions. This way, you can easily extend the setup that is
            // needed per test type.

            function setupApplicationTest(hooks, options) {
              upstreamSetupApplicationTest(hooks, options);

              // Additional setup for application tests can be done here.
              //
              // For example, if you need an authenticated session for each
              // application test, you could do:
              //
              // hooks.beforeEach(async function () {
              //   await authenticateSession(); // ember-simple-auth
              // });
              //
              // This is also a good place to call test setup functions coming
              // from other addons:
              //
              // setupIntl(hooks); // ember-intl
              // setupMirage(hooks); // ember-cli-mirage
              setupContainerAssertions(hooks);
            }

            function setupRenderingTest(hooks, options) {
              upstreamSetupRenderingTest(hooks, options);

              // Additional setup for rendering tests can be done here.
            }

            function setupTest(hooks, options) {
              upstreamSetupTest(hooks, options);

              // Additional setup for unit tests can be done here.
            }

            function setupContainerAssertions(hooks) {
              hooks.beforeEach(function (assert) {
                assert.containerDoesNotHave = (
                  name,
                  message = \`Container should not contain \${name}\`
                ) => {
                  assert.notOk(Boolean(this.owner.lookup(name)), message);
                };
              });
            }

            export { setupApplicationTest, setupRenderingTest, setupTest };

          `,
        },
      },
      'ember-cli-build.js': `
        'use strict';

        const EmberApp = require('ember-cli/lib/broccoli/ember-app');
        const { maybeEmbroider } = require('@embroider/test-setup');

        module.exports = function (defaults) {
          let app = new EmberApp(defaults, {
            ...(process.env.FORCE_BUILD_TESTS
              ? {
                  tests: true,
                }
              : undefined),
            'ember-bootstrap': {
              bootstrapVersion: 4,
              importBootstrapCSS: true,
            },
          });

          return maybeEmbroider(app, {
            packageRules: [
              {
                package: 'app-template',
                components: {
                  '{{fancy-box}}': {
                    acceptsComponentArguments: [
                      {
                        name: 'titleComponent',
                        becomes: 'this.titleComponentWithDefault',
                      },
                    ],
                  },
                },
              },
            ],
          });
        };

      `,
    });
  })
  .forEachScenario(scenario => {
    Qmodule(scenario.name, function (hooks) {
      let app: PreparedApp;
      hooks.before(async () => {
        app = await scenario.prepare();
      });

      test(`pnpm test: development`, async function (assert) {
        let result = await app.execute(`pnpm test`);
        assert.equal(result.exitCode, 0, result.output);
      });

      test(`pnpm test: production`, async function (assert) {
        let result = await app.execute(`pnpm vite build --mode production`, {
          env: {
            FORCE_BUILD_TESTS: 'true',
          },
        });
        assert.equal(result.exitCode, 0, result.output);
        result = await app.execute(`pnpm ember test --path dist`);
        assert.equal(result.exitCode, 0, result.output);
      });
    });
  });

function emberBootstrap() {
  // https://github.com/kaliber5/ember-bootstrap/pull/1750
  let modifiers = Project.fromDir(dirname(require.resolve('@ember/render-modifiers')), { linkDeps: true });
  modifiers.removeDependency('ember-source');
  let eb = Project.fromDir(dirname(require.resolve('ember-bootstrap')), { linkDeps: true });
  eb.addDependency(modifiers);
  return eb;
}
