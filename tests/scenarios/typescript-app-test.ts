import { tsAppScenarios } from './scenarios';
import { PreparedApp } from 'scenario-tester';
import QUnit from 'qunit';
import merge from 'lodash/merge';
const { module: Qmodule, test } = QUnit;

tsAppScenarios
  .skip('lts_3_16')
  .skip('lts_3_24')
  .map('typescript-app', project => {
    merge(project.files, {
      app: {
        components: {
          'incrementer.ts': `
            import Component from '@glimmer/component';
            import { tracked } from '@glimmer/tracking';
            import { action } from '@ember/object';

            interface Signature {
              Element: HTMLDivElement;
              Blocks: {
                default: [number]
              }
            }

            export default class Incrementer extends Component<Signature> {
              @tracked count = 0;

              @action increment() { this.count++ }
            }
          `,
          'incrementer.hbs': `
            <div ...attributes>
              <button {{on 'click' this.increment}}>increment</button>
              {{yield this.count}}
            </div>
          `,
        },
      },
      tests: {
        rendering: {
          'incrementer-test.ts': `
            import { module, test } from 'qunit';
            import { setupRenderingTest } from 'ember-qunit';
            import { render, click } from '@ember/test-helpers';
            import { hbs } from 'ember-cli-htmlbars';

            module('Rendering', function (hooks) {
              setupRenderingTest(hooks);

              test('increments', async function (assert) {
                await render(hbs\`
                  <Incrementer as |count|>
                    <out>{{count}}</out>
                  </Incrementer>
                \`);

                assert.dom('out').hasText('0');

                await click('button');
                assert.dom('out').hasText('1');
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

      test(`yarn ember test`, async function (assert) {
        let result = await app.execute(`yarn ember test`);
        assert.equal(result.exitCode, 0, result.output);
      });
    });
  });
