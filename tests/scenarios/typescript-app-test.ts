import { tsAppScenarios } from './scenarios';
import type { PreparedApp } from 'scenario-tester';
import QUnit from 'qunit';
import merge from 'lodash/merge';
const { module: Qmodule, test } = QUnit;

let typescriptApp = tsAppScenarios.map('typescript-app', project => {
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
});

typescriptApp.forEachScenario(scenario => {
  Qmodule(scenario.name, function (hooks) {
    let app: PreparedApp;
    hooks.before(async () => {
      app = await scenario.prepare();
    });

    test(`check types`, async function (assert) {
      let result = await app.execute(`pnpm tsc`);
      assert.equal(result.exitCode, 0, result.output);
    });

    test(`pnpm ember test safe`, async function (assert) {
      let result = await app.execute(`ember test`, {
        env: {
          EMBROIDER_TEST_SETUP_OPTIONS: 'safe',
        },
      });
      assert.equal(result.exitCode, 0, result.output);
    });

    test(`pnpm ember test optimized`, async function (assert) {
      let result = await app.execute(`ember test`, {
        env: {
          EMBROIDER_TEST_SETUP_OPTIONS: 'optimized',
        },
      });
      assert.equal(result.exitCode, 0, result.output);
    });
  });
});
