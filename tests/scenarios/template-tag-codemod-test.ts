import { tsAppScenarios } from './scenarios';
import { PreparedApp } from 'scenario-tester';
import QUnit from 'qunit';
import { codeModAssertions } from '@embroider/test-support/codemod-assertions';

const { module: Qmodule, test } = QUnit;

tsAppScenarios
  .only('release')
  .map('template-tag-codemod', project => {
    project.linkDevDependency('@embroider/template-tag-codemod', { baseDir: __dirname });
    project.mergeFiles({
      app: {
        helpers: {
          't.js': `export default function t() {}`,
        },
        components: {
          'message-box.hbs': `<div></div>`,
        },
      },
    });
  })
  .forEachScenario(async scenario => {
    Qmodule(`${scenario.name}`, function (hooks) {
      let app: PreparedApp;
      hooks.before(async () => {
        // TODO: upstream a feature like this into scenario-tester itself. This
        // makes it possible to rapidly iterate these tests without constantly
        // rebuilding the scenario.
        //
        // 1. pnpm test:output --scenario release-template-tag-codemod --outdir ~/hacking/scenario
        // 2. REUSE_SCENARIO=~/hacking/scenario pnpm qunit --require ts-node/register template-tag-codemod-test.ts
        if (process.env.REUSE_SCENARIO) {
          app = new PreparedApp(process.env.REUSE_SCENARIO);
        } else {
          app = await scenario.prepare();
        }
      });

      codeModAssertions(hooks, () => app);

      test('hbs only component to gjs', async function (assert) {
        await assert.codeMod({
          from: { 'app/components/example.hbs': 'Hello world' },
          to: { 'app/components/example.gjs': '<template>Hello world</template>' },
          via: 'npx template-tag-codemod  --renderTests false --routeTemplates false --components ./app/components/example.hbs',
        });
      });

      test('hbs only component to gts', async function (assert) {
        await assert.codeMod({
          from: { 'app/components/example.hbs': 'Hello world' },
          to: {
            'app/components/example.gts': `
              import type { TemplateOnlyComponent } from '@ember/component/template-only';
              export default <template>Hello world</template> satisfies TemplateOnlyComponent<{ Args: {} }>`,
          },
          via: 'npx template-tag-codemod  --renderTests false --routeTemplates false --components ./app/components/example.hbs --defaultFormat gts',
        });
      });

      test('helper used as both content and attribute', async function (assert) {
        await assert.codeMod({
          from: { 'app/components/example.hbs': `<div data-test={{t "hello"}}>{{t "hello"}}</div>` },
          to: {
            'app/components/example.gjs': `
              import t from "../helpers/t.js";
              <template><div data-test={{t "hello"}}>{{t "hello"}}</div></template>
            `,
          },
          via: 'npx template-tag-codemod  --renderTests false --routeTemplates false --components ./app/components/example.hbs',
        });
      });

      test('name collision between original js and added import', async function (assert) {
        await assert.codeMod({
          from: {
            'app/components/example.hbs': `<div>{{t "hello"}}</div>`,
            'app/components/example.js': `
              import t from "./somewhere-else.js";
              import Component from "@glimmer/component";
              export default class extends Component {
                get thing() {
                  return t();
                }
              }
            `,
          },
          to: {
            'app/components/example.gjs': `
              import t from "./somewhere-else.js";
              import Component from "@glimmer/component";
              import t0 from "../helpers/t.js";
              export default class extends Component {<template><div>{{t0 "hello"}}</div></template>
                get thing() {
                  return t();
                }
              }
            `,
          },
          via: 'npx template-tag-codemod  --renderTests false --routeTemplates false --components ./app/components/example.hbs',
        });
      });

      test('basic route template - native js', async function (assert) {
        await assert.codeMod({
          from: {
            'app/templates/example.hbs': `<div>{{t "hello"}}</div>`,
          },
          to: {
            'app/templates/example.gjs': `
              import t from "../helpers/t.js";
              <template><div>{{t "hello"}}</div></template>
            `,
          },
          via: 'npx template-tag-codemod  --renderTests false --routeTemplates ./app/templates/example.hbs --components false',
        });
      });

      test('basic route template - native ts', async function (assert) {
        await assert.codeMod({
          from: {
            'app/templates/example.hbs': `<div>{{t "hello"}}</div>`,
          },
          to: {
            'app/templates/example.gts': `
              import type { TemplateOnlyComponent } from '@ember/component/template-only';
              import t from "../helpers/t.js";
              export default <template><div>{{t "hello"}}</div></template> satisfies TemplateOnlyComponent<{ Args: { model: unknown, controller: unknown } }>
            `,
          },
          via: 'npx template-tag-codemod  --renderTests false --routeTemplates ./app/templates/example.hbs --components false --defaultFormat gts',
        });
      });

      test('basic route template - addon js', async function (assert) {
        await assert.codeMod({
          from: {
            'app/templates/example.hbs': `<div>{{t "hello"}}</div>`,
          },
          to: {
            'app/templates/example.gjs': `
              import RouteTemplate from 'ember-route-template
              import t from "../helpers/t.js";
              export default RouteTemplate(<template><div>{{t "hello"}}</div></template>)
            `,
          },
          via: 'npx template-tag-codemod  --renderTests false --routeTemplates ./app/templates/example.hbs --components false --nativeRouteTemplates false',
        });
      });

      test('basic route template - addon ts', async function (assert) {
        await assert.codeMod({
          from: {
            'app/templates/example.hbs': `<div>{{t "hello"}}</div>`,
          },
          to: {
            'app/templates/example.gts': `
              import RouteTemplate from 'ember-route-template
              import t from "../helpers/t.js";
              export default RouteTemplate<{ Args: { model: unknown, controller: unknown } }>(<template><div>{{t "hello"}}</div></template>)
            `,
          },
          via: 'npx template-tag-codemod  --renderTests false --routeTemplates ./app/templates/example.hbs --components false --nativeRouteTemplates false --defaultFormat gts',
        });
      });

      test('route template rewrite this to @controller', async function (assert) {
        await assert.codeMod({
          from: {
            'app/templates/example.hbs': `<div>{{t this.message}}</div>`,
          },
          to: {
            'app/templates/example.gjs': `
              import t from "../helpers/t.js";
              <template><div>{{t @controller.message}}</div></template>
            `,
          },
          via: 'npx template-tag-codemod  --renderTests false --routeTemplates ./app/templates/example.hbs --components false',
        });
      });

      test('convert rendering test with native lexical this', async function (assert) {
        await assert.codeMod({
          from: {
            'tests/integration/components/example-test.js': `

              import { module, test } from 'qunit';
              import { setupRenderingTest } from 'ember-qunit';
              import { render } from '@ember/test-helpers';
              import { hbs } from 'ember-cli-htmlbars';

              module('Integration | Component | message-box', function (hooks) {
                setupRenderingTest(hooks);
                test('it renders', async function (assert) {
                  await render(hbs\`<MessageBox @thing={{this.thing}} />\`);
                  assert.strictEqual(this.element.textContent.trim(), 'template block text');
                });
              });
            `,
          },
          to: {
            'tests/integration/components/example-test.gjs': `

              import { module, test } from 'qunit';
              import { setupRenderingTest } from 'ember-qunit';
              import { render } from '@ember/test-helpers';
              import MessageBox from "../../../app/components/message-box.js";

              module('Integration | Component | message-box', function (hooks) {
                setupRenderingTest(hooks);
                test('it renders', async function (assert) {
                  await render(<template><MessageBox @thing={{this.thing}} /></template>);
                  assert.strictEqual(this.element.textContent.trim(), 'template block text');
                });
              });
            `,
          },
          via: 'npx template-tag-codemod  --renderTests ./tests/integration/components/example-test.js --routeTemplates false --components false ',
        });
      });

      test('convert rendering test without native lexical this', async function (assert) {
        await assert.codeMod({
          from: {
            'tests/integration/components/example-test.js': `

              import { module, test } from 'qunit';
              import { setupRenderingTest } from 'ember-qunit';
              import { render } from '@ember/test-helpers';
              import { hbs } from 'ember-cli-htmlbars';

              module('Integration | Component | message-box', function (hooks) {
                setupRenderingTest(hooks);
                test('it renders', async function (assert) {
                  await render(hbs\`<MessageBox @thing={{this.thing}} />\`);
                  assert.strictEqual(this.element.textContent.trim(), 'template block text');
                });
                test('with self already in local scope', async function (assert) {
                  let self = 'hi';
                  await render(hbs\`<MessageBox @thing={{this.thing}} />\`);
                  assert.strictEqual(this.element.textContent.trim(), 'template block text');
                });
              });
            `,
          },
          to: {
            'tests/integration/components/example-test.gjs': `

              import { module, test } from 'qunit';
              import { setupRenderingTest } from 'ember-qunit';
              import { render } from '@ember/test-helpers';
              import MessageBox from "../../../app/components/message-box.js";

              module('Integration | Component | message-box', function (hooks) {
                setupRenderingTest(hooks);
                test('it renders', async function (assert) {
                  const self = this;
                  await render(<template><MessageBox @thing={{self.thing}} /></template>);
                  assert.strictEqual(this.element.textContent.trim(), 'template block text');
                });
                test('with self already in local scope', async function (assert) {
                  let self = 'hi';
                  const self0 = this;
                  await render(<template><MessageBox @thing={{self0.thing}} /></template>);
                  assert.strictEqual(this.element.textContent.trim(), 'template block text');
                });
              });
            `,
          },
          via: 'npx template-tag-codemod  --renderTests ./tests/integration/components/example-test.js --routeTemplates false --components false --nativeLexicalThis false',
        });
      });
    });
  });
