import { appScenarios, baseAddon, baseV2Addon } from './scenarios';
import type { PreparedApp } from 'scenario-tester';
import QUnit from 'qunit';
import merge from 'lodash/merge';

const { module: Qmodule, test } = QUnit;

appScenarios
  .map('nested-layout-components', project => {
    const v1Addon = baseAddon();
    v1Addon.pkg.name = 'v1-addon';
    merge(v1Addon.files, {
      app: {
        components: {
          'v1-nested-layout-component': {
            'index.js': 'export { default } from "v1-addon/components/v1-nested-layout-component";',
          },
        },
      },
      addon: {
        components: {
          'v1-nested-layout-component': {
            'index.hbs': '<div>nested layout components in v1 addons work</div>',
          },
        },
      },
    });
    project.addDevDependency(v1Addon);

    const v2Addon = baseV2Addon();
    v2Addon.pkg.name = 'v2-addon';
    (v2Addon.pkg as any)['ember-addon']['app-js']['./components/v2-nested-layout-component/index.js'] =
      './app/components/v2-nested-layout-component/index.js';

    merge(v2Addon.files, {
      app: {
        components: {
          'v2-nested-layout-component': {
            'index.js': `export { default } from 'v2-addon/components/v2-nested-layout-component/index';`,
          },
        },
      },
      components: {
        'v2-nested-layout-component': {
          'index.js': `
            import Component from '@glimmer/component';
            import { hbs } from 'ember-cli-htmlbars';
            import { setComponentTemplate } from '@ember/component';
            const TEMPLATE = hbs('<div>{{this.message}}</div>')
            export default class V2NestedLayoutComponent extends Component {
              message = "nested layout components in v2 addons work"
            }
            setComponentTemplate(TEMPLATE, V2NestedLayoutComponent);
          `,
        },
      },
    });

    project.addDevDependency(v2Addon);

    merge(project.files, {
      app: {
        components: {
          'local-nested-layout-component': {
            'index.hbs': '<div>local nested layout components work</div>',
          },
        },
      },
      tests: {
        intergration: {
          'nested-layout-components-test.js': `
            import { module, test } from 'qunit';
            import { setupRenderingTest } from 'ember-qunit';
            import { render } from '@ember/test-helpers';
            import hbs from 'htmlbars-inline-precompile';

            module('Integration | nested-layout-components', function(hooks) {
              setupRenderingTest(hooks);

              test('local nested layout components work', async function(assert) {
                await render(hbs('<LocalNestedLayoutComponent />'));
                assert.dom().containsText('local nested layout components work');
              });

              test('nested layout components in v1 addons work', async function(assert) {
                await render(hbs('<V1NestedLayoutComponent />'));
                assert.dom().containsText('nested layout components in v1 addons work');
              });

              test('nested layout components in v1 addons work', async function(assert) {
                await render(hbs('<V2NestedLayoutComponent />'));
                assert.dom().containsText('nested layout components in v2 addons work');
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
        let result = await app.execute('pnpm test', {
          env: {
            EMBROIDER_TEST_SETUP_OPTIONS: 'optimized',
          },
        });
        assert.equal(result.exitCode, 0, result.output);
      });
    });
  });
