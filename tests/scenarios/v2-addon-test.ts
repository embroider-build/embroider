import { appScenarios } from './scenarios';
import { PreparedApp, Project } from 'scenario-tester';
import QUnit from 'qunit';
import merge from 'lodash/merge';
import { AddonMeta } from '@embroider/shared-internals';
const { module: Qmodule, test } = QUnit;

appScenarios
  .map('v2-addon', project => {
    let meta: AddonMeta = {
      type: 'addon',
      version: 2,
      'app-js': {
        './components/example-component.js': 'app/components/example-component.js',
      },
      main: 'addon-main.js',
    };

    let packageJSON = {
      keywords: ['ember-addon'],
      'ember-addon': meta,
    };

    let addon = new Project({
      name: 'v2-addon',
      files: {
        'package.json': JSON.stringify(packageJSON, null, 2),
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
      },
    });
    addon.linkDependency('@embroider/addon-shim', { baseDir: __dirname });

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
