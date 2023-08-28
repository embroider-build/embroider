import { appScenarios, baseAddon, baseV2Addon } from './scenarios';
import type { PreparedApp } from 'scenario-tester';
import QUnit from 'qunit';
import merge from 'lodash/merge';

const { module: Qmodule, test } = QUnit;

appScenarios
  .map('v2-addon-basics', project => {
    let addon = baseV2Addon();
    addon.pkg.name = 'v2-addon';
    (addon.pkg as any)['ember-addon']['app-js']['./components/example-component.js'] =
      './app/components/example-component.js';
    merge(addon.files, {
      app: {
        components: {
          'example-component.js': `export { default } from 'v2-addon/components/example-component';`,
        },
      },
      components: {
        'example-component.js': `
          import Component from '@glimmer/component';
          import { hbs } from 'ember-cli-htmlbars';
          import { setComponentTemplate } from '@ember/component';
          import './example-component.css';
          const TEMPLATE = hbs('<div data-test-example>{{this.message}}</div>')
          export default class ExampleComponent extends Component {
            message = "it worked"
          }
          setComponentTemplate(TEMPLATE, ExampleComponent);
        `,
        'example-component.css': '/* not empty */ h1 { color: red }',
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

    // a v1 addon, which will have a v2 addon as a dep
    let intermediate = baseAddon();
    intermediate.pkg.name = 'intermediate';
    intermediate.linkDependency('ember-auto-import', { baseDir: __dirname });
    merge(intermediate.files, {
      app: {
        components: {
          'hello.js': 'export { default } from "intermediate/components/hello"',
        },
      },
      addon: {
        components: {
          'hello.hbs': '<div class="intermediate-hello"><Inner /></div>',
        },
      },
    });
    project.addDevDependency(intermediate);

    // the inner v2 addon, which gets consumed by `intermediate`
    let inner = baseV2Addon();
    inner.pkg.name = 'inner';
    (inner.pkg as any)['ember-addon']['app-js']['./components/inner.js'] = './app/components/inner.js';
    merge(inner.files, {
      app: {
        components: {
          'inner.js': `export { default } from 'inner/components/inner';`,
        },
      },
      components: {
        'inner.js': `
          import Component from '@glimmer/component';
          import { hbs } from 'ember-cli-htmlbars';
          import { setComponentTemplate } from '@ember/component';
          const TEMPLATE = hbs("<div class='inner'>it works</div>")
          export default class ExampleComponent extends Component {}
          setComponentTemplate(TEMPLATE, ExampleComponent);
        `,
      },
    });
    intermediate.addDependency(inner);

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
        intergration: {
          'intermediate-test.js': `
            import { module, test } from 'qunit';
            import { setupRenderingTest } from 'ember-qunit';
            import { render } from '@ember/test-helpers';
            import hbs from 'htmlbars-inline-precompile';

            module('Integration | intermediate', function(hooks) {
              setupRenderingTest(hooks);

              test('v1 addon can invoke v2 addon through the app tree', async function(assert) {
                await render(hbs('<Hello />'));
                assert.dom('.intermediate-hello .inner').containsText('it works');
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

      test(`pnpm test`, async function (assert) {
        let result = await app.execute('pnpm test');
        assert.equal(result.exitCode, 0, result.output);
      });
    });
  });
