import { appScenarios } from './scenarios';
import type { PreparedApp } from 'scenario-tester';
import QUnit from 'qunit';
import merge from 'lodash/merge';
const { module: Qmodule, test } = QUnit;

appScenarios
  .only('canary')
  .map('transform-@glimmer/tracking', project => {
    merge(project.files, {
      app: {
        components: {
          'demo.js': `
            import Component from '@glimmer/component';
            import { cached } from '@glimmer/tracking';

            export default class Demo extends Component {
              @cached
              get foo() {
                return 'boop';
              }
            }
          `,
          'demo.hbs': `{{this.foo}}`,
        },
      },
      tests: {
        rendering: {
          'demo-test.js': `

            import { module, test } from 'qunit';
            import { render } from '@ember/test-helpers';
            import { setupRenderingTest } from 'ember-qunit';
            import { hbs } from 'ember-cli-htmlbars';

            module('<Demo>', function(hooks) {
              setupRenderingTest(hooks);

              test(\`doesn't error\`, async function(assert) {
                await render(hbs\`<Demo />\`);

                assert.dom().hasText('boop');
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
        await app.execute('pnpm build');
        let result = await app.execute('pnpm test --dir dist');
        assert.equal(result.exitCode, 0, result.output);
      });
    });
  });
