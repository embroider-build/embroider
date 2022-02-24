import { appScenarios, baseV2Addon } from './scenarios';
import { PreparedApp } from 'scenario-tester';
import QUnit from 'qunit';
import merge from 'lodash/merge';

const { module: Qmodule, test } = QUnit;

appScenarios
  .map('v2-addon', project => {
    let addon = baseV2Addon();
    addon.pkg.name = 'v2-addon';
    (addon.pkg as any)['ember-addon']['app-js']['./components/example-component.js'] =
      'app/components/example-component.js';
    merge(addon.files, {
      app: {
        components: {
          'example-component.js': `export { default } from 'v2-addon/components/example-component';`,
        },
      },
      'addon-main.js': `
          const { addonV1Shim } = require('@embroider/addon-shim');
          module.exports = addonV1Shim(__dirname);
        `,
      components: {
        'example-component.js': `
              import Component from '@glimmer/component';
              import { hbs } from 'ember-cli-htmlbars';
              import { setComponentTemplate } from '@ember/component';
              const TEMPLATE = hbs('<div data-test-example>{{this.message}}</div>')
              export default class ExampleComponent extends Component {
                message = "it worked"
              }
              setComponentTemplate(TEMPLATE, ExampleComponent);
            `,
      },
      'import-from-npm.js': `
          export default async function() { 
            let { message } = await import('third-party');
            return message() 
          }
        `,
    });

    addon.addDependency('third-party', {
      files: {
        'index.js': `
          export function message() {
            return 'content from third-party';
          }
        `,
      },
    });

    project.addDevDependency(addon);

    merge(project.files, {
      app: {
        templates: {
          'index.hbs': `
            <ExampleComponent />
          `,
        },
      },
      tests: {
        acceptance: {
          'index-test.js': `
            import { module, test } from 'qunit';
            import { visit } from '@ember/test-helpers';
            import { setupApplicationTest } from 'ember-qunit';
            import { getOwnConfig } from '@embroider/macros';

            module('Acceptance | index', function(hooks) {
              setupApplicationTest(hooks);

              test('hello world', async function(assert) {
                await visit('/');
                assert.ok(document.querySelector('[data-test-example]'), 'it worked');
              });
            });
          `,
        },
        unit: {
          'import-test.js': `
           import { module, test } from 'qunit';
           import example from 'v2-addon/import-from-npm';
           module('Unit | import', function(hooks) {
             test('v2 addons can import() from NPM', async function(assert) {
              assert.equal(await example(), 'content from third-party');
             });
           });
          `,
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

      test(`yarn test`, async function (assert) {
        let result = await app.execute('yarn test');
        assert.equal(result.exitCode, 0, result.output);
      });
    });
  });
