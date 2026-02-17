import { baseV2Addon, tsAppScenarios } from './scenarios';
import { PreparedApp } from 'scenario-tester';
import QUnit from 'qunit';
import { codeModAssertions } from '@embroider/test-support/codemod-assertions';
import { dirname, join } from 'path';

const { module: Qmodule, test } = QUnit;

tsAppScenarios
  .only('release')
  .map('template-tag-codemod', project => {
    project.linkDevDependency('@embroider/template-tag-codemod', { baseDir: __dirname });
    project.mergeFiles({
      app: {
        helpers: {
          't.js': `export default function t() {}`,
          'div.js': `export default function div(a,b) { return a / b }`,
        },
        components: {
          'message-box.hbs': `<div></div>`,
          nested: {
            'example.js': 'export default class {}',
          },
        },
      },
      lib: {
        'custom-renaming.mjs': `
          import defaultRules from '@embroider/template-tag-codemod/default-renaming';
          export default function customRenaming(name, kind) {
            let result = defaultRules(name, kind);
            if (result === 'MessageBox') {
              return 'CustomRenamedMessageBox';
            }
            return result;
          }
        `,
        'custom-resolver.mjs': `
          export default async function customResolver(path) {
            if (path === '@embroider/virtual/components/fancy-ice-cream') {
              return 'bar/really-exists/foo';
            }
          }
        `,
        'another-resolver.mjs': `
          export default async function(path, filename, resolve) {
            if (path === '@embroider/virtual/components/phone-booth') {
              path = '@embroider/virtual/components/message-box';
            }
            return await resolve(path, filename);
          }
        `,
      },
    });

    let myAddon = baseV2Addon();
    myAddon.pkg.name = 'my-addon';
    myAddon.pkg.exports = {
      './*': './*.js',
    };
    myAddon.mergeFiles({
      _app_: {
        components: {
          'reexported-widget.js': `export { default } from "my-addon/components/widget"`,
        },
      },
      components: {
        'widget.js': `export default function () {}`,
      },
    });
    myAddon.pkg['ember-addon']['app-js'] = {
      './components/reexported-widget.js': './_app_/components/reexported-widget.js',
    };
    project.addDevDependency(myAddon);
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
      const templateTagPath = join(dirname(require.resolve('@embroider/template-tag-codemod')), 'cli.js');

      test('hbs only component to gjs', async function (assert) {
        await assert.codeMod({
          from: { 'app/components/example.hbs': 'Hello world' },
          to: { 'app/components/example.gjs': '<template>Hello world</template>' },
          via: `node ${templateTagPath} --reusePrebuild --renderTests false --routeTemplates false --components ./app/components/example.hbs`,
        });
      });

      test('default handling for ::-namespaced components', async function (assert) {
        await assert.codeMod({
          from: { 'app/components/example.hbs': '<Nested::Example />' },
          to: {
            'app/components/example.gjs': `
            import Example from "./nested/example.js";
            <template><Example /></template>`,
          },
          via: `node ${templateTagPath} --reusePrebuild  --renderTests false --routeTemplates false --components ./app/components/example.hbs`,
        });
      });

      test('default handling for @-namespaced components', async function (assert) {
        await assert.codeMod({
          from: { 'app/components/example.hbs': '{{component "my-addon@widget"}}' },
          to: {
            'app/components/example.gjs': `
            import Widget from "my-addon/components/widget";
            <template>{{component Widget}}</template>`,
          },
          via: `node ${templateTagPath} --reusePrebuild  --renderTests false --routeTemplates false --components ./app/components/example.hbs`,
        });
      });

      test('default handling for known HTML element collisions', async function (assert) {
        await assert.codeMod({
          from: { 'app/components/example.hbs': '<div>The answer is {{div 4 2}}</div>' },
          to: {
            'app/components/example.gjs': `
            import div_ from "../helpers/div.js";
            <template><div>The answer is {{div_ 4 2}}</div></template>`,
          },
          via: `node ${templateTagPath} --reusePrebuild  --renderTests false --routeTemplates false --components ./app/components/example.hbs`,
        });
      });

      test('default handling for lowercase components', async function (assert) {
        await assert.codeMod({
          from: { 'app/components/example.hbs': '{{component "message-box"}}' },
          to: {
            'app/components/example.gjs': `
            import MessageBox from "./message-box.js";
            <template>{{component MessageBox}}</template>`,
          },
          via: `node ${templateTagPath} --reusePrebuild  --renderTests false --routeTemplates false --components ./app/components/example.hbs`,
        });
      });

      test('custom renaming', async function (assert) {
        await assert.codeMod({
          from: { 'app/components/example.hbs': '<MessageBox />' },
          to: {
            'app/components/example.gjs': `
            import CustomRenamedMessageBox from "./message-box.js";
            <template><CustomRenamedMessageBox /></template>`,
          },
          via: `node ${templateTagPath} --reusePrebuild  --renderTests false --routeTemplates false --components ./app/components/example.hbs --renamingRules "./lib/custom-renaming.mjs"`,
        });
      });

      test('custom resolver', async function (assert) {
        await assert.codeMod({
          from: { 'app/components/example.hbs': '<FancyIceCream />' },
          to: {
            'app/components/example.gjs': `
            import FancyIceCream from "bar/really-exists/foo";
            <template><FancyIceCream /></template>`,
          },
          via: `node ${templateTagPath} --reusePrebuild  --renderTests false --routeTemplates false --components ./app/components/example.hbs --customResolver "./lib/custom-resolver.mjs"`,
        });
      });

      test('custom resolver using the default implementation', async function (assert) {
        await assert.codeMod({
          from: { 'app/components/example.hbs': '<PhoneBooth />' },
          to: {
            'app/components/example.gjs': `
            import PhoneBooth from "./message-box.js";
            <template><PhoneBooth /></template>`,
          },
          via: `node ${templateTagPath} --reusePrebuild  --renderTests false --routeTemplates false --components ./app/components/example.hbs --customResolver "./lib/another-resolver.mjs"`,
        });
      });

      test('traverses through app reexports', async function (assert) {
        await assert.codeMod({
          from: { 'app/components/example.hbs': '<ReexportedWidget />' },
          to: {
            'app/components/example.gjs': `
            import ReexportedWidget from "my-addon/components/widget";
            <template><ReexportedWidget /></template>`,
          },
          via: `node ${templateTagPath} --reusePrebuild  --renderTests false --routeTemplates false --components ./app/components/example.hbs`,
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
          via: `node ${templateTagPath} --reusePrebuild  --renderTests false --routeTemplates false --components ./app/components/example.hbs --defaultFormat gts`,
        });
      });

      test('hbs only component to gts with a named const', async function (assert) {
        await assert.codeMod({
          from: { 'app/components/example.hbs': 'Hello world' },
          to: {
            'app/components/example.gts': `
              import type { TemplateOnlyComponent } from '@ember/component/template-only';
              const Example = <template>Hello world</template> satisfies TemplateOnlyComponent<{ Args: {} }>;
              export default Example;`,
          },
          via: `node ${templateTagPath} --addNameToTemplateOnly --reusePrebuild --renderTests false --routeTemplates false --components ./app/components/example.hbs --defaultFormat gts`,
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
          via: `node ${templateTagPath} --reusePrebuild  --renderTests false --routeTemplates false --components ./app/components/example.hbs`,
        });
      });

      test('adding named const to a template-only component', async function (assert) {
        await assert.codeMod({
          from: { 'app/components/example-foo-bar.hbs': 'Hello world' },
          to: {
            'app/components/example-foo-bar.gjs': `
              const ExampleFooBar = <template>Hello world</template>;
              export default ExampleFooBar;
            `,
          },
          via: `node ${templateTagPath} --addNameToTemplateOnly --reusePrebuild --renderTests false --routeTemplates false --components ./app/components/example-foo-bar.hbs`,
        });
      });

      test('adding named const to a template-only component with a name collision', async function (assert) {
        await assert.codeMod({
          from: { 'app/components/example.hbs': '<Nested::Example />' },
          to: {
            'app/components/example.gjs': `
              import Example from "./nested/example.js";
              const Example0 = <template><Example /></template>;
              export default Example0;
            `,
          },
          via: `node ${templateTagPath} --addNameToTemplateOnly --reusePrebuild --renderTests false --routeTemplates false --components ./app/components/example.hbs`,
        });
      });

      test('basic js backing component', async function (assert) {
        await assert.codeMod({
          from: {
            'app/components/example.hbs': `<button {{on "click" this.clicked}}>Click me</button>`,
            'app/components/example.js': `
              import Component from "@ember/component";
              export default class extends Component {

                clicked() {
                  alert('i got clicked');
                }
              }
            `,
          },
          to: {
            'app/components/example.gjs': `
              import Component from "@ember/component";
              import { on } from "@ember/modifier";
              export default class extends Component {<template><button {{on "click" this.clicked}}>Click me</button></template>
                clicked() {
                  alert('i got clicked');
                }
              }
            `,
          },
          via: `node ${templateTagPath} --reusePrebuild  --renderTests false --routeTemplates false --components ./app/components/example.hbs`,
        });
      });

      test('non-native class syntax', async function (assert) {
        await assert.codeModFailure({
          from: {
            'app/components/example.hbs': `<button {{on "click" this.clicked}}>Click me</button>`,
            'app/components/example.js': `
              import Component from "@ember/component";
              export default Component.extend({
                clicked() {
                  alert('i got clicked');
                }
              })
            `,
          },
          matches:
            /This codemod does not support old styles Component\.extend\(\) syntax\. Convert to a native class first\./,
          via: `node ${templateTagPath} --reusePrebuild  --renderTests false --routeTemplates false --components ./app/components/example.hbs`,
        });
      });

      test('js backing component with separate export statement', async function (assert) {
        await assert.codeMod({
          from: {
            'app/components/example.hbs': `<button {{on "click" this.clicked}}>Click me</button>`,
            'app/components/example.js': `
              import Component from "@ember/component";
              class Foo extends Component {

                clicked() {
                  alert('i got clicked');
                }
              }
              export default Foo;
            `,
          },
          to: {
            'app/components/example.gjs': `
              import Component from "@ember/component";
              import { on } from "@ember/modifier";
              class Foo extends Component {<template><button {{on "click" this.clicked}}>Click me</button></template>
                clicked() {
                  alert('i got clicked');
                }
              }
              export default Foo;
            `,
          },
          via: `node ${templateTagPath} --reusePrebuild  --renderTests false --routeTemplates false --components ./app/components/example.hbs`,
        });
      });

      test('loose-mode registry augmentation', async function (assert) {
        await assert.codeMod({
          from: {
            'app/components/example.hbs': `Hello world`,
            'app/components/example.ts': `
              import Component from '@glimmer/component';

              interface FooSignature {
                Args: {
                  value?: string;
                };
              }

              export default class Foo extends Component<FooSignature> {
                get value() {
                  return this.args.value ?? '';
                }
              }

              declare module '@glint/environment-ember-loose/registry' {
                export default interface Registry {
                  Foo: typeof Foo;
                }
              }
            `,
          },
          to: {
            'app/components/example.gts': `
              import Component from '@glimmer/component';

              interface FooSignature {
                Args: {
                  value?: string;
                };
              }

              export default class Foo extends Component<FooSignature> {<template>Hello world</template>
                get value() {
                  return this.args.value ?? '';
                }
              }

              declare module '@glint/environment-ember-loose/registry' {
                export default interface Registry {
                  Foo: typeof Foo;
                }
              }            `,
          },
          via: `node ${templateTagPath} --reusePrebuild  --renderTests false --routeTemplates false --components ./app/components/example.hbs`,
        });
      });

      test('template-only ts component', async function (assert) {
        await assert.codeMod({
          from: {
            'app/components/example.hbs': `Hello world`,
            'app/components/example.ts': `
              import templateOnlyComponent from '@ember/component/template-only';
              interface FooSignature {
                Args: {
                  value: string;
                };
              }
              export default templateOnlyComponent<FooSignature>();
            `,
          },
          to: {
            'app/components/example.gts': `
              import type { TemplateOnlyComponent } from '@ember/component/template-only';
              interface FooSignature {
                Args: {
                  value: string;
                };
              }
              export default <template>Hello world</template> satisfies TemplateOnlyComponent<FooSignature>;
            `,
          },
          via: 'npx template-tag-codemod --reusePrebuild  --renderTests false --routeTemplates false --components ./app/components/example.hbs',
        });
      });

      test('template-only ts component with separate export statement', async function (assert) {
        await assert.codeMod({
          from: {
            'app/components/example.hbs': `Hello world`,
            'app/components/example.ts': `
              import templateOnlyComponent from '@ember/component/template-only';
              interface FooSignature {
                Args: {
                  value: string;
                };
              }
              const Foo = templateOnlyComponent<FooSignature>();
              export default Foo;
            `,
          },
          to: {
            'app/components/example.gts': `
              import type { TemplateOnlyComponent } from '@ember/component/template-only';
              interface FooSignature {
                Args: {
                  value: string;
                };
              }
              const Foo = <template>Hello world</template> satisfies TemplateOnlyComponent<FooSignature>;
              export default Foo;
            `,
          },
          via: 'npx template-tag-codemod --reusePrebuild  --renderTests false --routeTemplates false --components ./app/components/example.hbs',
        });
      });

      test('template-only ts component without signature', async function (assert) {
        await assert.codeMod({
          from: {
            'app/components/example.hbs': `Hello world`,
            'app/components/example.ts': `
              import templateOnlyComponent from '@ember/component/template-only';
              export default templateOnlyComponent();
            `,
          },
          to: {
            'app/components/example.gts': `
              export default <template>Hello world</template>;
            `,
          },
          via: 'npx template-tag-codemod --reusePrebuild  --renderTests false --routeTemplates false --components ./app/components/example.hbs',
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
          via: `node ${templateTagPath} --reusePrebuild  --renderTests false --routeTemplates false --components ./app/components/example.hbs`,
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
          via: `node ${templateTagPath} --reusePrebuild  --renderTests false --routeTemplates ./app/templates/example.hbs --components false`,
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
          via: `node ${templateTagPath} --reusePrebuild  --renderTests false --routeTemplates ./app/templates/example.hbs --components false --defaultFormat gts`,
        });
      });

      test('basic route template - addon js', async function (assert) {
        await assert.codeMod({
          from: {
            'app/templates/example.hbs': `<div>{{t "hello"}}</div>`,
          },
          to: {
            'app/templates/example.gjs': `
              import RouteTemplate from 'ember-route-template'
              import t from "../helpers/t.js";
              export default RouteTemplate(<template><div>{{t "hello"}}</div></template>)
            `,
          },
          via: `node ${templateTagPath} --reusePrebuild  --renderTests false --routeTemplates ./app/templates/example.hbs --components false --nativeRouteTemplates false`,
        });
      });

      test('basic route template - addon ts', async function (assert) {
        await assert.codeMod({
          from: {
            'app/templates/example.hbs': `<div>{{t "hello"}}</div>`,
          },
          to: {
            'app/templates/example.gts': `
              import RouteTemplate from 'ember-route-template'
              import t from "../helpers/t.js";
              export default RouteTemplate<{ Args: { model: unknown, controller: unknown } }>(<template><div>{{t "hello"}}</div></template>)
            `,
          },
          via: `node ${templateTagPath} --reusePrebuild  --renderTests false --routeTemplates ./app/templates/example.hbs --components false --nativeRouteTemplates false --defaultFormat gts`,
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
          via: `node ${templateTagPath} --reusePrebuild  --renderTests false --routeTemplates ./app/templates/example.hbs --components false`,
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
          via: `node ${templateTagPath} --reusePrebuild  --renderTests ./tests/integration/components/example-test.js --routeTemplates false --components false `,
        });
      });

      test('empty pojo argument to precompileTemplate', async function (assert) {
        await assert.codeMod({
          from: {
            'tests/integration/components/example-test.js': `
              import { precompileTemplate } from '@ember/template-compilation';
              import { render } from '@ember/test-helpers';
              render(precompileTemplate('<div></div>', {}));
            `,
          },
          to: {
            'tests/integration/components/example-test.gjs': `
              import { render } from '@ember/test-helpers';
              render(<template><div></div></template>);
            `,
          },
          via: `node ${templateTagPath} --reusePrebuild  --renderTests ./tests/integration/components/example-test.js --routeTemplates false --components false`,
        });
      });

      test('rendering test with template defined outside render() and no other references', async function (assert) {
        await assert.codeMod({
          from: {
            'tests/integration/components/example-test.js': `
              import { precompileTemplate } from '@ember/template-compilation';
              import { render } from '@ember/test-helpers';
              let template = precompileTemplate('<div></div>')
              render(template);
            `,
          },
          to: {
            'tests/integration/components/example-test.gjs': `
              import { render } from '@ember/test-helpers';
              let template = <template><div></div></template>
              render(template);
            `,
          },
          via: `node ${templateTagPath} --reusePrebuild  --renderTests ./tests/integration/components/example-test.js --routeTemplates false --components false`,
        });
      });

      test('rendering test with template defined outside render() with extra references', async function (assert) {
        await assert.codeModFailure({
          from: {
            'tests/integration/components/example-test.js': `
              import { precompileTemplate } from '@ember/template-compilation';
              import { render } from '@ember/test-helpers';
              let template = precompileTemplate('<div></div>')
              doSomethingTo(template);
              render(template);
            `,
          },
          matches:
            /unsupported syntax in rendering test: local variable "template" is a template but it's used in multiple places/,
          via: `node ${templateTagPath} --reusePrebuild  --renderTests ./tests/integration/components/example-test.js --routeTemplates false --components false`,
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
                test('need to introduce self', async function (assert) {
                  await render(hbs\`<MessageBox @thing={{this.thing}} />\`);
                  await render(hbs\`<MessageBox @thing={{this.thing}} />\`);
                });
                test('with unrelated self already in local scope', async function (assert) {
                  let self = 'hi';
                  await render(hbs\`<MessageBox @thing={{this.thing}} />\`);
                  await render(hbs\`<MessageBox @thing={{this.thing}} />\`);
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
                test('need to introduce self', async function (assert) {const self = this;
                  await render(<template><MessageBox @thing={{self.thing}} /></template>);
                  await render(<template><MessageBox @thing={{self.thing}} /></template>);
                });
                test('with unrelated self already in local scope', async function (assert) {const self0 = this;
                  let self = 'hi';
                  await render(<template><MessageBox @thing={{self0.thing}} /></template>);
                  await render(<template><MessageBox @thing={{self0.thing}} /></template>);
                });
              });
            `,
          },
          via: `node ${templateTagPath} --reusePrebuild  --renderTests ./tests/integration/components/example-test.js --routeTemplates false --components false --nativeLexicalThis false`,
        });
      });

      test('convert rendering test, this binding with no tail, with native lexical this', async function (assert) {
        await assert.codeMod({
          from: {
            'tests/integration/components/example-test.js': `
              import { render } from '@ember/test-helpers';
              import { hbs } from 'ember-cli-htmlbars';

              module('Integration | Component | message-box', function (hooks) {
                test('need to introduce self', async function (assert) {
                  await render(hbs\`<MessageBox @thing={{this}} />\`);
                });
              });
            `,
          },
          to: {
            'tests/integration/components/example-test.gjs': `
              import { render } from '@ember/test-helpers';
              import MessageBox from "../../../app/components/message-box.js";

              module('Integration | Component | message-box', function (hooks) {
                test('need to introduce self', async function (assert) {
                  await render(<template><MessageBox @thing={{this}} /></template>);
                });
              });
            `,
          },
          via: `node ${templateTagPath} --reusePrebuild  --renderTests ./tests/integration/components/example-test.js --routeTemplates false --components false`,
        });
      });

      test('convert rendering test, this binding with no tail, without native lexical this', async function (assert) {
        await assert.codeMod({
          from: {
            'tests/integration/components/example-test.js': `
              import { render } from '@ember/test-helpers';
              import { hbs } from 'ember-cli-htmlbars';

              module('Integration | Component | message-box', function (hooks) {
                test('need to introduce self', async function (assert) {
                  await render(hbs\`<MessageBox @thing={{this}} />\`);
                });
              });
            `,
          },
          to: {
            'tests/integration/components/example-test.gjs': `
              import { render } from '@ember/test-helpers';
              import MessageBox from "../../../app/components/message-box.js";

              module('Integration | Component | message-box', function (hooks) {
                test('need to introduce self', async function (assert) {const self = this;
                  await render(<template><MessageBox @thing={{self}} /></template>);
                });
              });
            `,
          },
          via: `node ${templateTagPath} --reusePrebuild  --renderTests ./tests/integration/components/example-test.js --routeTemplates false --components false --nativeLexicalThis false`,
        });
      });

      test('legacy hbs module name', async function (assert) {
        await assert.codeMod({
          from: {
            'tests/integration/components/example-test.js': `
              import { module, test } from 'qunit';
              import { render } from '@ember/test-helpers';
              import hbs from 'htmlbars-inline-precompile';
              module('Integration | Component | message-box', function (hooks) {
                test('example', async function (assert) {
                  await render(hbs\`<MessageBox />\`);
                });
              });
            `,
          },
          to: {
            'tests/integration/components/example-test.gjs': `
              import { module, test } from 'qunit';
              import { render } from '@ember/test-helpers';
              import MessageBox from "../../../app/components/message-box.js";

              module('Integration | Component | message-box', function (hooks) {
                test('example', async function (assert) {
                  await render(<template><MessageBox /></template>);
                });
              });
            `,
          },
          via: `node ${templateTagPath} --reusePrebuild  --renderTests ./tests/integration/components/example-test.js --routeTemplates false --components false`,
        });
      });

      test('comment lines among the imports are left alone', async function (assert) {
        await assert.codeMod({
          from: {
            'tests/integration/components/example-test.js': `
              import { module, test } from 'qunit';
              import { render } from '@ember/test-helpers';
              // @ts-expect-error
              import hbs from 'htmlbars-inline-precompile';
              module('Integration | Component | message-box', function (hooks) {
                test('example', async function (assert) {
                  await render(hbs\`<MessageBox />\`);
                });
              });
            `,
          },
          to: {
            'tests/integration/components/example-test.gjs': `
              import { module, test } from 'qunit';
              import { render } from '@ember/test-helpers';
              // @ts-expect-error
              import MessageBox from "../../../app/components/message-box.js";
              module('Integration | Component | message-box', function (hooks) {
                test('example', async function (assert) {
                  await render(<template><MessageBox /></template>);
                });
              });
            `,
          },
          via: `node ${templateTagPath} --reusePrebuild  --renderTests ./tests/integration/components/example-test.js --routeTemplates false --components false`,
        });
      });

      test('template compiler printer quoting bug', async function (assert) {
        await assert.codeMod({
          from: {
            'app/components/example.hbs': `
              <MessageBox @copyText='{{@crate.name}} = "{{@crate.default_version}}"' />
            `,
          },
          to: {
            'app/components/example.gjs': `
            import MessageBox from "./message-box.js";
            <template>
              <MessageBox @copyText='{{@crate.name}} = "{{@crate.default_version}}"' />
            </template>
            `,
          },
          via: 'npx template-tag-codemod  --renderTests false --routeTemplates false --components ./app/components/example.hbs',
        });
      });
    });
  });
