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

            export default class FancyBox extends Component {
              get titleComponentWithDefault() {
                return this.args.titleComponent || 'default-title';
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
        helpers: {
          'loaded-components.js': `
            /* global requirejs */
            import { helper } from '@ember/component/helper';

            export function loadedComponents() {
              let result = new Set();
              for (let name of Object.keys(requirejs.entries)) {
                let m = /^[a-zA-Z0-9_-]+\\/components\\/(.*)/.exec(name);
                if (m) {
                  result.add(m[1]);
                }
                m = /^[a-zA-Z0-9_-]+\\/templates\\/components\\/(.*)/.exec(name);
                if (m) {
                  result.add(m[1]);
                }
              }
              return [...result];
            }

            export default helper(loadedComponents);
          `,
          'loaded-helpers.js': `
            /* global requirejs */
            import { helper } from '@ember/component/helper';

            export function loadedHelpers() {
              return Object.keys(requirejs.entries)
                .map(k => { let m = /^[a-zA-Z0-9_-]+\\/helpers\\/(.*)/.exec(k); if (m){ return m[1]}}).filter(Boolean).sort();
            }

            export default helper(loadedHelpers);
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
        templates: {
          'components-example.hbs': `
            {{! this uses a component from ember-bootstrap }}
            <BsButton>Button</BsButton>

            {{! then this lists all the components loaded into our app.}}
            {{#each (loaded-components) as |name|}}
              <div data-component-name={{name}}>{{name}}</div>
            {{/each}}
          `,
          'helpers-example.hbs': `
            {{! this uses reverse helpers from my-helpers-addon }}
            {{#each (reverse (array "alpha" "beta")) as |word| }}
              <div data-word={{word}}>{{word}}</div>
            {{/each}}

            {{! then this lists all the helpers loaded into our app. It should have reverse from
            above, but none of the other stuff in the addon }}
            {{#each (loaded-helpers) as |name|}}
              <div data-helper-name={{name}}>{{name}}</div>
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
            import { setupApplicationTest } from 'ember-qunit';
            import { getOwnConfig } from '@embroider/macros';

            module('Acceptance | components-example', function(hooks) {
              setupApplicationTest(hooks);

              test('static components', async function(assert) {
                await visit('/components-example');

                let button = document.querySelector('.btn');
                assert.ok(button, 'found ember-bootstrap button');
                if (button) {
                  assert.equal(getComputedStyle(button)['background-color'], "rgb(108, 117, 125)", "bs-button has its CSS");
                }

                let components = [...document.querySelectorAll("[data-component-name]")].map(elt => elt.dataset.componentName);
                assert.ok(!components.includes('bs-button'), 'expected not to find bs-button because it got inserted via lexical scope');
                assert.ok(!components.includes('bs-carousel'), 'expected not to find bs-carousel in embroider build');
              });
            });
          `,
          'helpers-example-test.js': `
            import { module, test } from 'qunit';
            import { visit } from '@ember/test-helpers';
            import { setupApplicationTest } from 'ember-qunit';
            import { getOwnConfig, dependencySatisfies } from '@embroider/macros';

            module('Acceptance | helpers-example', function(hooks) {
              setupApplicationTest(hooks);

              test('static helpers', async function(assert) {
                await visit('/helpers-example');

                assert.deepEqual(
                  [...document.querySelectorAll("[data-word]")].map(elt => elt.dataset.word),
                  ['beta', 'alpha'],
                  'array and reverse worked'
                );

                let helpers = [...document.querySelectorAll("[data-helper-name]")].map(elt => elt.dataset.helperName);
                assert.ok(!helpers.includes('reverse'), 'expected not to find reverse, because it is provided directly via scope');
                assert.ok(!helpers.includes('intersect'), 'expected not to find intersect');
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
      },
      'ember-cli-build.js': `
        'use strict';

        const EmberApp = require('ember-cli/lib/broccoli/ember-app');
        const { maybeEmbroider } = require('@embroider/test-setup');

        module.exports = function (defaults) {
          let app = new EmberApp(defaults, {
            ...(process.env.FORCE_BUILD_TESTS ? {
              tests: true,
            } : undefined),
            'ember-bootstrap': {
              bootstrapVersion: 4,
              importBootstrapCSS: true
            }
          });

          return maybeEmbroider(app, {
            packageRules: [
              {
                package: 'app-template',
                appModules: {
                  'components/fancy-box.js': {
                    dependsOnComponents: ['{{default-title}}'],
                  },
                },
                components: {
                  '{{fancy-box}}': {
                    acceptsComponentArguments: [{ name: 'titleComponent', becomes: 'this.titleComponentWithDefault' }],
                  },
                },
              },
            ],
            skipBabel: [
              { package: 'qunit' },
              { package: 'macro-decorators' },
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
