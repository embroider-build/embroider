import { Transpiler } from '@embroider/test-support';
import type { ExpectFile } from '@embroider/test-support/file-assertions/qunit';
import { expectFilesAt } from '@embroider/test-support/file-assertions/qunit';
import { outputFileSync } from 'fs-extra';
import { resolve, sep } from 'path';

import QUnit from 'qunit';
import { Project, Scenarios } from 'scenario-tester';
import type { CompatResolverOptions } from '@embroider/compat/src/resolver-transform';
import type { PackageRules } from '@embroider/compat';

const { module: Qmodule, test } = QUnit;

Scenarios.fromProject(() => new Project())
  .map('compat-resolver-test', app => {
    app.pkg = {
      name: 'my-app',
    };
    app.mergeFiles({
      'index.html': '<script src="./templates/application.hbs" type="module"></script>',
    });
    app.linkDevDependency('babel-plugin-ember-template-compilation', {
      baseDir: __dirname,
    });
    app.linkDevDependency('@embroider/compat', { baseDir: __dirname });
    app.linkDevDependency('@embroider/core', { baseDir: __dirname });
  })
  .forEachScenario(scenario => {
    Qmodule(scenario.name, function (hooks) {
      let expectTranspiled: (file: string) => ReturnType<ReturnType<ExpectFile>['transform']>;
      let givenFiles: (files: Record<string, string>) => void;
      let configure: (
        opts?: Partial<CompatResolverOptions['options']>,
        extraOpts?: ConfigureOpts,
        emberVersion?: string
      ) => Promise<void>;

      interface ConfigureOpts {
        appPackageRules?: Partial<PackageRules>;
        astPlugins?: string[];
      }

      hooks.beforeEach(async assert => {
        let app = await scenario.prepare();
        let build = new Transpiler(app.dir);
        let expectFile = expectFilesAt(app.dir, { qunit: assert });
        expectTranspiled = (filename: string) => expectFile(filename).transform(build.transpile);

        givenFiles = function (files: Record<string, string>) {
          for (let [filename, contents] of Object.entries(files)) {
            outputFileSync(resolve(app.dir, filename), contents, 'utf8');
          }
        };
        configure = async function (
          opts?: Partial<CompatResolverOptions['options']>,
          extraOpts?: ConfigureOpts,
          emberVersion = '4.6.0'
        ) {
          let resolverOptions: CompatResolverOptions = {
            renameModules: {},
            renamePackages: {},
            resolvableExtensions: ['.js', '.hbs'],
            appRoot: app.dir,
            engines: [
              {
                packageName: 'my-app',
                root: app.dir,
                activeAddons: [],
                fastbootFiles: {},
                isLazy: false,
              },
            ],
            modulePrefix: 'my-app',
            podModulePrefix: undefined,
            options: {
              staticInvokables: false,
              allowUnsafeDynamicComponents: false,
              ...opts,
            },
            activePackageRules: [
              {
                package: 'my-app',
                roots: [app.dir],
                ...extraOpts?.appPackageRules,
              },
            ],
            staticAppPaths: [],
            emberVersion,
          };

          givenFiles({
            'babel.config.cjs': `
              const {
                babelCompatSupport,
                templateCompatSupport,
              } = require("@embroider/compat/babel");
              module.exports = {
                plugins: [
                  ['babel-plugin-ember-template-compilation', {
                    targetFormat: 'hbs',
                    transforms: [
                      ...(${JSON.stringify(extraOpts?.astPlugins ?? [])}),
                      ...templateCompatSupport(),
                    ],
                    enableLegacyModules: [
                      'ember-cli-htmlbars'
                    ]
                  }],
                  ...babelCompatSupport()
                ]
              }
            `,
            'node_modules/.embroider/resolver.json': JSON.stringify(resolverOptions),
          });
        };
      });

      test('emits no components when staticComponents is off', async function () {
        givenFiles({
          'components/hello-world.js': '',
          'templates/application.hbs': `{{hello-world}} <HelloWorld />`,
        });
        await configure();
        (await expectTranspiled('./templates/application.hbs')).equalsCode(`
        import { precompileTemplate } from "@ember/template-compilation";
        export default precompileTemplate("{{hello-world}} <HelloWorld />", {
          moduleName: "my-app/templates/application.hbs",
        });`);
      });

      test('bare dasherized component with no args is ambiguous', async function () {
        givenFiles({
          'templates/application.hbs': `{{hello-world}}`,
        });

        await configure({ staticInvokables: true }, {}, '3.28.0');

        (await expectTranspiled('./templates/application.hbs')).failsToTransform(`"{{hello-world}}" is ambiguous`);
      });

      test('bare dasherized component manually disambiguated to component', async function () {
        givenFiles({
          'templates/application.hbs': `{{hello-world}}`,
        });

        await configure(
          { staticInvokables: true },
          {
            appPackageRules: {
              appTemplates: {
                'templates/application.hbs': {
                  disambiguate: {
                    'hello-world': 'component',
                  },
                },
              },
            },
          }
        );

        (await expectTranspiled('./templates/application.hbs')).equalsCode(`
            import { precompileTemplate } from "@ember/template-compilation";
            import helloWorld from "@embroider/virtual/components/hello-world";
            export default precompileTemplate("{{helloWorld}}", {
              moduleName: "my-app/templates/application.hbs",
              scope: () => ({
                helloWorld
              }),
            });
        `);
      });

      test('bare dasherized component with arg', async function () {
        givenFiles({
          'templates/application.hbs': `{{hello-world arg=1}}`,
        });

        await configure({ staticInvokables: true });

        (await expectTranspiled('templates/application.hbs')).equalsCode(`
            import { precompileTemplate } from "@ember/template-compilation";
            import helloWorld from "@embroider/virtual/ambiguous/hello-world";
            export default precompileTemplate("{{helloWorld arg=1}}", {
              moduleName: "my-app/templates/application.hbs",
              scope: () => ({
                helloWorld
              }),
            });
        `);
      });

      test('bare dasherized helper with arg', async function () {
        givenFiles({
          'templates/application.hbs': `{{hello-world arg=1}}`,
        });

        await configure({ staticInvokables: true });

        (await expectTranspiled('templates/application.hbs')).equalsCode(`
            import { precompileTemplate } from "@ember/template-compilation";
            import helloWorld from "@embroider/virtual/ambiguous/hello-world";
            export default precompileTemplate("{{helloWorld arg=1}}", {
              moduleName: "my-app/templates/application.hbs",
              scope: () => ({
                helloWorld
              }),
            });
        `);
      });

      test('nested bare dasherized component', async function () {
        givenFiles({
          'templates/application.hbs': `{{something/hello-world}}`,
        });
        await configure({ staticInvokables: true });
        (await expectTranspiled('templates/application.hbs')).equalsCode(`
            import { precompileTemplate } from "@ember/template-compilation";
            import somethingHelloWorld from "@embroider/virtual/ambiguous/something/hello-world";
            export default precompileTemplate("{{somethingHelloWorld}}", {
              moduleName: "my-app/templates/application.hbs",
              scope: () => ({
                somethingHelloWorld,
              }),
            });
        `);
      });

      test('coalesces repeated components', async function () {
        givenFiles({
          'templates/application.hbs': `<HelloWorld /><HelloWorld />`,
        });
        await configure({ staticInvokables: true });
        (await expectTranspiled('templates/application.hbs')).equalsCode(`
          import { precompileTemplate } from "@ember/template-compilation";
          import HelloWorld from "@embroider/virtual/components/hello-world";
          export default precompileTemplate("<HelloWorld /><HelloWorld />", {
            moduleName: "my-app/templates/application.hbs",
            scope: () => ({
              HelloWorld
            })
          });
        `);
      });

      test('tolerates non path mustaches', async function () {
        givenFiles({
          'templates/application.hbs': `<Thing @foo={{1}} />`,
        });
        await configure({
          staticInvokables: true,
        });
        (await expectTranspiled('templates/application.hbs')).equalsCode(`
          import { precompileTemplate } from "@ember/template-compilation";
          import Thing from "@embroider/virtual/components/thing";
          export default precompileTemplate("<Thing @foo={{1}} />", {
            moduleName: "my-app/templates/application.hbs",
            scope: () => ({
              Thing
            })
          });
        `);
      });

      test('block form curly component', async function () {
        givenFiles({
          'templates/application.hbs': `{{#hello-world}} {{/hello-world}}`,
        });
        await configure({ staticInvokables: true });
        (await expectTranspiled('templates/application.hbs')).equalsCode(`
          import { precompileTemplate } from "@ember/template-compilation";
          import helloWorld from "@embroider/virtual/components/hello-world";
          export default precompileTemplate("{{#helloWorld}} {{/helloWorld}}", {
            moduleName: "my-app/templates/application.hbs",
            scope: () => ({
              helloWorld
            })
          });
        `);
      });

      test('non-block form angle component', async function () {
        givenFiles({
          'templates/application.hbs': `<HelloWorld />`,
        });
        await configure({ staticInvokables: true });
        (await expectTranspiled('templates/application.hbs')).equalsCode(`
          import { precompileTemplate } from "@ember/template-compilation";
          import HelloWorld from "@embroider/virtual/components/hello-world";
          export default precompileTemplate("<HelloWorld />", {
            moduleName: "my-app/templates/application.hbs",
            scope: () => ({
              HelloWorld
            })
          });
        `);
      });

      test('nested angle component', async function () {
        givenFiles({
          'templates/application.hbs': `<Hello::World />`,
        });
        await configure({ staticInvokables: true });
        (await expectTranspiled('templates/application.hbs')).equalsCode(`
          import { precompileTemplate } from "@ember/template-compilation";
          import HelloWorld from "@embroider/virtual/components/hello/world";
          export default precompileTemplate("<HelloWorld />", {
            moduleName: "my-app/templates/application.hbs",
            scope: () => ({
              HelloWorld
            })
          });
        `);
      });

      test('block form angle component', async function () {
        givenFiles({
          'templates/application.hbs': `<HelloWorld></HelloWorld>`,
        });
        await configure({ staticInvokables: true });
        (await expectTranspiled('templates/application.hbs')).equalsCode(`
          import { precompileTemplate } from "@ember/template-compilation";
          import HelloWorld from "@embroider/virtual/components/hello-world";
          export default precompileTemplate("<HelloWorld></HelloWorld>", {
            moduleName: "my-app/templates/application.hbs",
            scope: () => ({
              HelloWorld
            })
          });
        `);
      });

      test('curly contextual component is left alone', async function () {
        givenFiles({
          'templates/application.hbs.js': `
            import { precompileTemplate } from '@ember/template-compilation';
            precompileTemplate('{{#helloWorld as |h|}} {{h.title flavor="chocolate"}} {{/helloWorld}}', {
              scope: () => ({ helloWorld })
            });
          `,
        });
        await configure({ staticInvokables: true });
        (await expectTranspiled('templates/application.hbs.js')).equalsCode(`
          import { precompileTemplate } from '@ember/template-compilation';
          precompileTemplate('{{#helloWorld as |h|}} {{h.title flavor="chocolate"}} {{/helloWorld}}', {
            scope: () => ({ helloWorld })
          });
        `);
      });

      test('uppercase angle contextual component is left alone', async function () {
        givenFiles({
          'templates/application.hbs.js': `
            import { precompileTemplate } from '@ember/template-compilation';
            precompileTemplate('<helloWorld as |H|> <H.title @flavor="chocolate" /> </helloWorld>', {
              scope: () => ({ helloWorld })
            });
          `,
        });
        await configure({ staticInvokables: true });
        (await expectTranspiled('templates/application.hbs.js')).equalsCode(`
          import { precompileTemplate } from '@ember/template-compilation';
          precompileTemplate('<helloWorld as |H|> <H.title @flavor="chocolate" /> </helloWorld>', {
            scope: () => ({ helloWorld })
          });
        `);
      });

      test('lowercase angle contextual component is left alone', async function () {
        givenFiles({
          'templates/application.hbs.js': `
            import { precompileTemplate } from '@ember/template-compilation';
            precompileTemplate('<helloWorld as |h|> <h.title @flavor="chocolate" /> </helloWorld>', {
              scope: () => ({ helloWorld })
            });
          `,
        });
        await configure({ staticInvokables: true });
        (await expectTranspiled('templates/application.hbs.js')).equalsCode(`
          import { precompileTemplate } from '@ember/template-compilation';
          precompileTemplate('<helloWorld as |h|> <h.title @flavor="chocolate" /> </helloWorld>', {
            scope: () => ({ helloWorld })
          });
        `);
      });

      test('optional component missing', async function () {
        givenFiles({
          'templates/application.hbs': `{{this-one x=true}}<ThisOne />`,
        });
        await configure(
          { staticInvokables: true },
          {
            appPackageRules: {
              components: {
                '{{this-one}}': { safeToIgnore: true },
              },
            },
          }
        );
        (await expectTranspiled('templates/application.hbs')).equalsCode(`
          import { precompileTemplate } from "@ember/template-compilation";
          export default precompileTemplate("{{this-one x=true}}<ThisOne />", {
            moduleName: "my-app/templates/application.hbs"
          });
        `);
      });

      test('optional component missing in mustache block', async function () {
        givenFiles({
          'templates/application.hbs': `{{#this-one}} {{/this-one}}`,
        });
        await configure(
          { staticInvokables: true },
          {
            appPackageRules: {
              components: {
                '{{this-one}}': { safeToIgnore: true },
              },
            },
          }
        );
        (await expectTranspiled('templates/application.hbs')).equalsCode(`
          import { precompileTemplate } from "@ember/template-compilation";
          export default precompileTemplate("{{#this-one}} {{/this-one}}", {
            moduleName: "my-app/templates/application.hbs"
          });
        `);
      });

      test('optional component missing in element syntax', async function () {
        givenFiles({
          'templates/application.hbs': `<ThisOne />`,
        });
        await configure(
          { staticInvokables: true },
          {
            appPackageRules: {
              components: {
                '{{this-one}}': { safeToIgnore: true },
              },
            },
          }
        );
        (await expectTranspiled('templates/application.hbs')).equalsCode(`
          import { precompileTemplate } from "@ember/template-compilation";
          export default precompileTemplate("<ThisOne />", {
            moduleName: "my-app/templates/application.hbs"
          });
        `);
      });

      test('component rules can be expressed via component helper', async function () {
        givenFiles({
          'templates/application.hbs': `{{this-one x=true}}`,
        });
        await configure(
          { staticInvokables: true },
          {
            appPackageRules: {
              components: {
                '{{component "this-one"}}': { safeToIgnore: true },
              },
            },
          }
        );
        (await expectTranspiled('templates/application.hbs')).equalsCode(`
          import { precompileTemplate } from "@ember/template-compilation";
          export default precompileTemplate("{{this-one x=true}}", {
            moduleName: "my-app/templates/application.hbs"
          });
        `);
      });

      test('component rules can be expressed via angle syntax', async function () {
        givenFiles({
          'templates/application.hbs': `{{this-one x=true}}`,
        });
        await configure(
          { staticInvokables: true },
          {
            appPackageRules: {
              components: {
                '<ThisOne />': { safeToIgnore: true },
              },
            },
          }
        );
        (await expectTranspiled('templates/application.hbs')).equalsCode(`
          import { precompileTemplate } from "@ember/template-compilation";
          export default precompileTemplate("{{this-one x=true}}", {
            moduleName: "my-app/templates/application.hbs"
          });
        `);
      });

      test('acceptsComponentArguments works on all copies of a lexically-inserted component, element syntax', async function () {
        givenFiles({
          'templates/application.hbs': `<HelloWorld @iAmAComponent='first-target' /><HelloWorld @iAmAComponent='second-target' />`,
        });

        await configure(
          { staticInvokables: true },
          {
            appPackageRules: {
              components: {
                '<HelloWorld />': {
                  acceptsComponentArguments: ['iAmAComponent'],
                },
              },
            },
          }
        );

        (await expectTranspiled('templates/application.hbs')).equalsCode(`
          import { precompileTemplate } from "@ember/template-compilation";
          import HelloWorld from "@embroider/virtual/components/hello-world";
          import firstTarget from "@embroider/virtual/components/first-target";
          import secondTarget from "@embroider/virtual/components/second-target";
          export default precompileTemplate("<HelloWorld @iAmAComponent={{firstTarget}} /><HelloWorld @iAmAComponent={{secondTarget}} />", {
            moduleName: "my-app/templates/application.hbs",
            scope: () => ({
              HelloWorld,
              firstTarget,
              secondTarget,
            }),
          });
        `);
      });

      test('acceptsComponentArguments works on all copies of a lexically-inserted component, mustache block syntax', async function () {
        givenFiles({
          'templates/application.hbs': `{{#hello-world iAmAComponent='first-target' }}{{/hello-world}}{{#hello-world iAmAComponent='second-target' }}{{/hello-world}}`,
        });
        await configure(
          { staticInvokables: true },
          {
            appPackageRules: {
              components: {
                '<HelloWorld />': {
                  acceptsComponentArguments: ['iAmAComponent'],
                },
              },
            },
          }
        );

        (await expectTranspiled('templates/application.hbs')).equalsCode(`
          import { precompileTemplate } from "@ember/template-compilation";
          import helloWorld from "@embroider/virtual/components/hello-world";
          import firstTarget from "@embroider/virtual/components/first-target";
          import secondTarget from "@embroider/virtual/components/second-target";
          export default precompileTemplate("{{#helloWorld iAmAComponent=firstTarget}}{{/helloWorld}}{{#helloWorld iAmAComponent=secondTarget}}{{/helloWorld}}", {
            moduleName: "my-app/templates/application.hbs",
            scope: () => ({
              helloWorld,
              firstTarget,
              secondTarget,
            }),
          });
        `);
      });

      test('acceptsComponentArguments works on all copies of a lexically-inserted component, mustache syntax', async function () {
        givenFiles({
          'templates/application.hbs': `{{hello-world iAmAComponent='first-target' }}{{hello-world iAmAComponent='second-target' }}`,
        });
        await configure(
          { staticInvokables: true },
          {
            appPackageRules: {
              components: {
                '<HelloWorld />': {
                  acceptsComponentArguments: ['iAmAComponent'],
                },
              },
            },
          }
        );

        (await expectTranspiled('templates/application.hbs')).equalsCode(`
          import { precompileTemplate } from "@ember/template-compilation";
          import helloWorld from "@embroider/virtual/ambiguous/hello-world";
          import firstTarget from "@embroider/virtual/components/first-target";
          import secondTarget from "@embroider/virtual/components/second-target";
          export default precompileTemplate("{{helloWorld iAmAComponent=firstTarget}}{{helloWorld iAmAComponent=secondTarget}}", {
            moduleName: "my-app/templates/application.hbs",
            scope: () => ({
              helloWorld,
              firstTarget,
              secondTarget,
            }),
          });
        `);
      });

      test('helper in content position on this, no args', async function () {
        givenFiles({
          'templates/application.hbs': `{{(this.myHelper)}}`,
        });
        await configure({ staticInvokables: true });
        (await expectTranspiled('templates/application.hbs')).equalsCode(`
          import { precompileTemplate } from "@ember/template-compilation";
          export default precompileTemplate("{{(this.myHelper)}}", {
            moduleName: "my-app/templates/application.hbs"
          });
        `);
      });

      test('helper in content position on this, with arguments', async function () {
        givenFiles({
          'templates/application.hbs': `{{(this.myHelper 42)}}`,
        });
        await configure({ staticInvokables: true });
        (await expectTranspiled('templates/application.hbs')).equalsCode(`
          import { precompileTemplate } from "@ember/template-compilation";
          export default precompileTemplate("{{(this.myHelper 42)}}", {
            moduleName: "my-app/templates/application.hbs"
          });
        `);
      });

      test('helper in subexpression position on this', async function () {
        givenFiles({
          'templates/application.hbs': `{{#if (this.myHelper)}}{{/if}}`,
        });
        await configure({ staticInvokables: true });
        (await expectTranspiled('templates/application.hbs')).equalsCode(`
          import { precompileTemplate } from "@ember/template-compilation";
          export default precompileTemplate("{{#if (this.myHelper)}}{{/if}}", {
            moduleName: "my-app/templates/application.hbs"
          });
        `);
      });

      test('ignores dot-rule subexpression helper invocation', async function () {
        givenFiles({
          'templates/application.hbs': `{{#if (thing.is 1) }}{{/if}}`,
        });
        await configure({
          staticInvokables: true,
        });
        (await expectTranspiled('templates/application.hbs')).equalsCode(`
        import { precompileTemplate } from "@ember/template-compilation";
        export default precompileTemplate("{{#if (thing.is 1)}}{{/if}}", {
          moduleName: "my-app/templates/application.hbs"
        });
      `);
      });

      test('ignores at-rule subexpression helper invocation', async function () {
        givenFiles({
          'templates/application.hbs': `{{#if (@thing 1) }}{{/if}}`,
        });
        await configure({
          staticInvokables: true,
        });
        (await expectTranspiled('templates/application.hbs')).equalsCode(`
        import { precompileTemplate } from "@ember/template-compilation";
        export default precompileTemplate("{{#if (@thing 1)}}{{/if}}", {
          moduleName: "my-app/templates/application.hbs"
        });
      `);
      });

      test('helper in component argument', async function () {
        givenFiles({
          'templates/application.hbs': `<Stuff @value={{myHelper 1}}/>`,
        });
        await configure({ staticInvokables: true });
        (await expectTranspiled('templates/application.hbs')).equalsCode(`
          import { precompileTemplate } from "@ember/template-compilation";
          import Stuff from "@embroider/virtual/components/stuff"
          import myHelper from "@embroider/virtual/helpers/myHelper";
          export default precompileTemplate("<Stuff @value={{myHelper 1}} />", {
            moduleName: "my-app/templates/application.hbs",
            scope: () => ({
              Stuff,
              myHelper,
            }),
          });
        `);
      });

      test('helper in html attribute', async function () {
        givenFiles({
          'templates/application.hbs': `<div class={{myHelper 1}}/>`,
        });
        await configure({ staticInvokables: true });
        (await expectTranspiled('templates/application.hbs')).equalsCode(`
          import { precompileTemplate } from "@ember/template-compilation";
          import myHelper from "@embroider/virtual/helpers/myHelper";
          export default precompileTemplate("<div class={{myHelper 1}} />", {
            moduleName: "my-app/templates/application.hbs",
            scope: () => ({
               myHelper,
            }),
          });
        `);
      });

      test('helper name collision with html element', async function () {
        givenFiles({
          'templates/application.hbs': `{{#let (div this.a this.b) as |c|}}
          <div>{{c}}</div>
        {{/let}}`,
        });
        await configure({ staticInvokables: true });
        (await expectTranspiled('templates/application.hbs')).equalsCode(`
          import { precompileTemplate } from "@ember/template-compilation";
          import div_ from "@embroider/virtual/helpers/div";
          export default precompileTemplate('{{#let (div_ this.a this.b) as |c|}}\\n          <div>{{c}}</div>\\n        {{/let}}', {
            moduleName: "my-app/templates/application.hbs",
            scope: () => ({
              div_
            })
          });
        `);
      });

      test('helper name collision with js reserved keyword', async function () {
        givenFiles({
          'templates/application.hbs': `<div class={{await 1}}/>`,
        });
        await configure({ staticInvokables: true });
        (await expectTranspiled('templates/application.hbs')).equalsCode(`
          import { precompileTemplate } from "@ember/template-compilation";
          import await_ from "@embroider/virtual/helpers/await";
          export default precompileTemplate("<div class={{await_ 1}} />", {
            moduleName: "my-app/templates/application.hbs",
            scope: () => ({
               await_,
            }),
          });
        `);
      });

      test('helper in content position, manually disambiguated', async function () {
        givenFiles({
          'templates/application.hbs': `{{myHelper}}`,
        });
        await configure(
          { staticInvokables: true },
          {
            appPackageRules: {
              appTemplates: {
                'templates/application.hbs': {
                  disambiguate: {
                    myHelper: 'helper',
                  },
                },
              },
            },
          }
        );
        (await expectTranspiled('templates/application.hbs')).equalsCode(`
          import { precompileTemplate } from "@ember/template-compilation";
          import myHelper from "@embroider/virtual/helpers/myHelper";
          export default precompileTemplate("{{myHelper}}", {
            moduleName: "my-app/templates/application.hbs",
            scope: () => ({
               myHelper,
            }),
          });
        `);
      });

      test('component in mustache block on this, no arg', async function () {
        givenFiles({
          'templates/application.hbs': `{{#this.myComponent}}hello{{/this.myComponent}}`,
        });
        await configure({ staticInvokables: true });
        (await expectTranspiled('templates/application.hbs')).equalsCode(`
          import { precompileTemplate } from "@ember/template-compilation";
          export default precompileTemplate("{{#this.myComponent}}hello{{/this.myComponent}}", {
            moduleName: "my-app/templates/application.hbs"
          });
        `);
      });

      test('component in mustache block on this, with arg', async function () {
        givenFiles({
          'templates/application.hbs': `{{#this.myComponent 42}}hello{{/this.myComponent}}`,
        });
        await configure({ staticInvokables: true });
        (await expectTranspiled('templates/application.hbs')).equalsCode(`
          import { precompileTemplate } from "@ember/template-compilation";
          export default precompileTemplate("{{#this.myComponent 42}}hello{{/this.myComponent}}", {
            moduleName: "my-app/templates/application.hbs"
          });
        `);
      });

      test('string literal passed to component helepr in content position', async function () {
        givenFiles({
          'templates/application.hbs': `{{component 'hello-world'}}`,
        });
        await configure({ staticInvokables: true });
        (await expectTranspiled('templates/application.hbs')).equalsCode(`
          import { precompileTemplate } from "@ember/template-compilation";
          import helloWorld from "@embroider/virtual/components/hello-world";
          export default precompileTemplate("{{component helloWorld}}", {
            moduleName: "my-app/templates/application.hbs",
            scope: () => ({
              helloWorld
            })
          });
        `);
      });

      test('string literal passed to component helper in content position', async function () {
        givenFiles({
          'templates/application.hbs': `{{helper 'hello-world'}}`,
        });
        await configure({ staticInvokables: true });
        (await expectTranspiled('templates/application.hbs')).equalsCode(`
          import { precompileTemplate } from "@ember/template-compilation";
          import helloWorld from "@embroider/virtual/helpers/hello-world";
          export default precompileTemplate("{{helper helloWorld}}", {
            moduleName: "my-app/templates/application.hbs",
            scope: () => ({
              helloWorld
            })
          });
        `);
      });

      test('string literal passed to component helper with block', async function () {
        givenFiles({
          'templates/application.hbs': `{{#component "hello-world"}}{{/component}}`,
        });
        await configure({ staticInvokables: true });
        (await expectTranspiled('templates/application.hbs')).equalsCode(`
          import { precompileTemplate } from "@ember/template-compilation";
          import helloWorld from "@embroider/virtual/components/hello-world";
          export default precompileTemplate("{{#component helloWorld}}{{/component}}", {
            moduleName: "my-app/templates/application.hbs",
            scope: () => ({
              helloWorld
            })
          });
        `);
      });

      test('string literal passed to component helper in helper position', async function () {
        givenFiles({
          'templates/application.hbs': `{{(component "hello-world")}}`,
        });
        await configure({ staticInvokables: true });
        (await expectTranspiled('templates/application.hbs')).equalsCode(`
          import { precompileTemplate } from "@ember/template-compilation";
          import helloWorld from "@embroider/virtual/components/hello-world";
          export default precompileTemplate("{{(component helloWorld)}}", {
            moduleName: "my-app/templates/application.hbs",
            scope: () => ({
              helloWorld
            })
          });
        `);
      });

      test('string literal passed to helper keyword in helper position', async function () {
        givenFiles({
          'templates/application.hbs': `{{(helper "hello-world")}}`,
        });
        await configure({ staticInvokables: true });
        (await expectTranspiled('templates/application.hbs')).equalsCode(`
          import { precompileTemplate } from "@ember/template-compilation";
          import helloWorld from "@embroider/virtual/helpers/hello-world";
          export default precompileTemplate("{{(helper helloWorld)}}", {
            moduleName: "my-app/templates/application.hbs",
            scope: () => ({
              helloWorld
            })
          });
        `);
      });

      test('helper currying', async function () {
        givenFiles({
          'templates/application.hbs': `
            {{#let (helper "hello-world" name="World") as |hello|}}
              {{#let (helper hello name="Tomster") as |helloTomster|}}
                {{helloTomster name="Zoey"}}
              {{/let}}
            {{/let}}
          `,
        });
        await configure({ staticInvokables: true });
        (await expectTranspiled('templates/application.hbs')).equalsCode(`
          import { precompileTemplate } from "@ember/template-compilation";
          import helloWorld from "@embroider/virtual/helpers/hello-world";
          export default precompileTemplate("\\n            {{#let (helper helloWorld name=\\"World\\") as |hello|}}\\n              {{#let (helper hello name=\\"Tomster\\") as |helloTomster|}}\\n                {{helloTomster name=\\"Zoey\\"}}\\n              {{/let}}\\n            {{/let}}\\n          ", {
            moduleName: "my-app/templates/application.hbs",
            scope: () => ({
              helloWorld,
            }),
          });
        `);
      });

      test('string literal passed to modifier keyword', async function () {
        givenFiles({
          'templates/application.hbs': `<div {{(modifier 'hello-world')}} />`,
        });
        await configure({ staticInvokables: true });
        (await expectTranspiled('templates/application.hbs')).equalsCode(`
          import { precompileTemplate } from "@ember/template-compilation";
          import helloWorld from "@embroider/virtual/modifiers/hello-world";
          export default precompileTemplate("<div {{(modifier helloWorld)}} />", {
            moduleName: "my-app/templates/application.hbs",
            scope: () => ({
              helloWorld
            })
          });
        `);
      });

      test('emits no modifiers when staticModifiers is off', async function () {
        givenFiles({
          'templates/application.hbs': `<div {{scroll-top}}/>`,
        });
        await configure({ staticInvokables: false });
        (await expectTranspiled('templates/application.hbs')).equalsCode(`
          import { precompileTemplate } from "@ember/template-compilation";
          export default precompileTemplate("<div {{scroll-top}} />", {
            moduleName: "my-app/templates/application.hbs"
          });
        `);
      });

      test('modifier on html element', async function () {
        givenFiles({
          'templates/application.hbs': `<div {{scroll-top}}/>`,
        });
        await configure({ staticInvokables: true });
        (await expectTranspiled('templates/application.hbs')).equalsCode(`
          import { precompileTemplate } from "@ember/template-compilation";
          import scrollTop from "@embroider/virtual/modifiers/scroll-top";
          export default precompileTemplate("<div {{scrollTop}} />", {
            moduleName: "my-app/templates/application.hbs",
            scope: () => ({
              scrollTop
            })
          });
        `);
      });

      test('modifier with arguments', async function () {
        givenFiles({
          'templates/application.hbs': `<div {{scroll-top @scrollTopPos}}/>`,
        });
        await configure({ staticInvokables: true });
        (await expectTranspiled('templates/application.hbs')).equalsCode(`
          import { precompileTemplate } from "@ember/template-compilation";
          import scrollTop from "@embroider/virtual/modifiers/scroll-top";
          export default precompileTemplate("<div {{scrollTop @scrollTopPos}} />", {
            moduleName: "my-app/templates/application.hbs",
            scope: () => ({
              scrollTop
            })
          });
        `);
      });

      test('modifier on component', async function () {
        givenFiles({
          'templates/application.hbs': `<Thing {{scroll-top @scrollTopPos}}/>`,
        });
        await configure({ staticInvokables: true });
        (await expectTranspiled('templates/application.hbs')).equalsCode(`
          import { precompileTemplate } from "@ember/template-compilation";
          import Thing from "@embroider/virtual/components/thing";
          import scrollTop from "@embroider/virtual/modifiers/scroll-top";
          export default precompileTemplate("<Thing {{scrollTop @scrollTopPos}} />", {
            moduleName: "my-app/templates/application.hbs",
            scope: () => ({
              Thing,
              scrollTop
            })
          });
        `);
      });

      test('modifier on contextual component', async function () {
        givenFiles({
          'templates/application.hbs': `<Thing as |f|><f.Input {{scroll-top @scrollTopPos}}/></Thing>`,
        });
        await configure({ staticInvokables: true });
        (await expectTranspiled('templates/application.hbs')).equalsCode(`
          import { precompileTemplate } from "@ember/template-compilation";
          import Thing from "@embroider/virtual/components/thing";
          import scrollTop from "@embroider/virtual/modifiers/scroll-top";
          export default precompileTemplate("<Thing as |f|><f.Input {{scrollTop @scrollTopPos}} /></Thing>", {
            moduleName: "my-app/templates/application.hbs",
            scope: () => ({
              Thing,
              scrollTop
            })
          });
        `);
      });

      test('modifier provided as an argument', async function () {
        givenFiles({
          'templates/application.hbs': `<input {{@auto-focus}} />`,
        });
        await configure({ staticInvokables: true });
        (await expectTranspiled('templates/application.hbs')).equalsCode(`
          import { precompileTemplate } from "@ember/template-compilation";
          export default precompileTemplate("<input {{@auto-focus}} />", {
            moduleName: "my-app/templates/application.hbs"
          });
        `);
      });

      test('contextual modifier', async function () {
        givenFiles({
          'templates/application.hbs': `<Form as |f|> <input {{f.auto-focus}} /></Form>`,
        });
        await configure({ staticInvokables: true });
        (await expectTranspiled('templates/application.hbs')).equalsCode(`
          import { precompileTemplate } from "@ember/template-compilation";
          import Form from "@embroider/virtual/components/form";
          export default precompileTemplate("<Form as |f|> <input {{f.auto-focus}} /></Form>", {
            moduleName: "my-app/templates/application.hbs",
            scope: () => ({
              Form,
            }),
          });
        `);
      });

      test('modifier currying', async function () {
        givenFiles({
          'templates/application.hbs': `{{#let (modifier "add-listener") as |addListener|}}
          {{#let (modifier addListener "click") as |addClickListener|}}
            <button {{addClickListener this.handleClick}}>Test</button>
          {{/let}}
        {{/let}}`,
        });
        await configure({ staticInvokables: true });
        (await expectTranspiled('templates/application.hbs')).equalsCode(`
          import { precompileTemplate } from "@ember/template-compilation";
          import addListener from "@embroider/virtual/modifiers/add-listener";
          export default precompileTemplate("{{#let (modifier addListener) as |addListener|}}\\n          {{#let (modifier addListener \\"click\\") as |addClickListener|}}\\n            <button {{addClickListener this.handleClick}}>Test</button>\\n          {{/let}}\\n        {{/let}}", {
            moduleName: "my-app/templates/application.hbs",
            scope: () => ({
              addListener
            })
          });
        `);
      });

      test('built-in components are imported when used with the component helper', async function () {
        givenFiles({
          'templates/application.hbs': `{{component "input"}}{{component "link-to"}}{{component "textarea"}}`,
        });
        await configure({ staticInvokables: true });
        (await expectTranspiled('templates/application.hbs')).equalsCode(`
        import { precompileTemplate } from "@ember/template-compilation";
        import { Input, Textarea } from "@ember/component";
        import { LinkTo } from "@ember/routing";
        export default precompileTemplate("{{component Input}}{{component LinkTo}}{{component Textarea}}", {
          moduleName: "my-app/templates/application.hbs",
          scope: () => ({
            Input,
            LinkTo,
            Textarea
          }),
        });
      `);
      });

      test('built-in components are imported when used directly', async function () {
        givenFiles({
          'templates/application.hbs': `<Input/><LinkTo/><Textarea/>`,
        });
        await configure({ staticInvokables: true });
        (await expectTranspiled('templates/application.hbs')).equalsCode(`
        import { precompileTemplate } from "@ember/template-compilation";
        import { Input, Textarea } from "@ember/component";
        import { LinkTo } from "@ember/routing";
        export default precompileTemplate("<Input /><LinkTo /><Textarea />", {
          moduleName: "my-app/templates/application.hbs",
          scope: () => ({
            Input,
            LinkTo,
            Textarea
          }),
        });
      `);
      });

      test('built-in helpers are imported when used with the helper keyword', async function () {
        givenFiles({
          'templates/application.hbs': `{{helper "fn"}}{{helper "array"}}{{helper "concat"}}`,
        });
        await configure({ staticInvokables: true });
        (await expectTranspiled('templates/application.hbs')).equalsCode(`
        import { precompileTemplate } from "@ember/template-compilation";
        import { fn, array, concat } from "@ember/helper";
        export default precompileTemplate("{{helper fn}}{{helper array}}{{helper concat}}", {
          moduleName: "my-app/templates/application.hbs",
          scope: () => ({
            fn,
            array,
            concat
          }),
        });
      `);
      });

      test('built-in helpers are imported when used directly', async function () {
        givenFiles({
          'templates/application.hbs': `{{(fn)}}{{(array)}}{{(concat)}}`,
        });
        await configure({ staticInvokables: true });
        (await expectTranspiled('templates/application.hbs')).equalsCode(`
        import { precompileTemplate } from "@ember/template-compilation";
        import { fn, array, concat } from "@ember/helper";
        export default precompileTemplate("{{(fn)}}{{(array)}}{{(concat)}}", {
          moduleName: "my-app/templates/application.hbs",
          scope: () => ({
            fn,
            array,
            concat
          }),
        });
      `);
      });

      test('built-in helper unique-id is not imported when used with ember source version <5.2', async function () {
        givenFiles({
          'templates/application.hbs': `{{(unique-id)}}`,
        });
        await configure({ staticInvokables: true }, undefined, '4.6.0');
        (await expectTranspiled('templates/application.hbs')).equalsCode(`
        import { precompileTemplate } from "@ember/template-compilation";
        export default precompileTemplate("{{(unique-id)}}", {
          moduleName: "my-app/templates/application.hbs",
        });
      `);
      });

      test('built-in helper unique-id is imported when used with ember source version >=5.2', async function () {
        givenFiles({
          'templates/application.hbs': `{{(unique-id)}}`,
        });
        await configure({ staticInvokables: true }, undefined, '5.2.0');
        (await expectTranspiled('templates/application.hbs')).equalsCode(`
        import { precompileTemplate } from "@ember/template-compilation";
        import { uniqueId } from "@ember/helper";
        export default precompileTemplate("{{(uniqueId)}}", {
          moduleName: "my-app/templates/application.hbs",
          scope: () => ({
            uniqueId,
          }),
        });
      `);
      });

      test('built-in modifiers are ignored when used with the modifier keyword', async function () {
        givenFiles({
          'templates/application.hbs': `{{modifier "on"}}{{modifier "action"}}`,
        });
        await configure({ staticInvokables: true });
        (await expectTranspiled('templates/application.hbs')).equalsCode(`
        import { precompileTemplate } from "@ember/template-compilation";
        export default precompileTemplate("{{modifier \\"on\\"}}{{modifier \\"action\\"}}", {
          moduleName: "my-app/templates/application.hbs"
        });
      `);
      });

      test('ignores built-in keywords', async function () {
        givenFiles({
          'templates/application.hbs': `
        {{outlet}}
        {{yield bar}}
        {{#let (hash submit=(action doit)) as |thing| }}
        {{/let}}
        <LinkTo @route="index"/>
        <form {{on "submit" doit}}></form>
      `,
        });
        await configure({ staticInvokables: true });
        (await expectTranspiled('templates/application.hbs')).equalsCode(`
        import { precompileTemplate } from "@ember/template-compilation";
        import { hash } from "@ember/helper";
        import { LinkTo } from "@ember/routing";
        import { on } from "@ember/modifier";
        export default precompileTemplate("\\n        {{outlet}}\\n        {{yield bar}}\\n        {{#let (hash submit=(action doit)) as |thing|}}\\n        {{/let}}\\n        <LinkTo @route=\\"index\\" />\\n        <form {{on \\"submit\\" doit}}></form>\\n      ", {
          moduleName: "my-app/templates/application.hbs",
          scope: () => ({
            hash,
            LinkTo,
            on,
          }),
        });
      `);
      });

      test('ambiguous invocation of built-in component', async function () {
        givenFiles({
          'templates/application.hbs': `{{input}}`,
        });

        await configure({ staticInvokables: true });

        (await expectTranspiled('./templates/application.hbs')).equalsCode(`
          import { precompileTemplate } from "@ember/template-compilation";
          import { Input } from "@ember/component";
          export default precompileTemplate("{{Input}}", {
            moduleName: "my-app/templates/application.hbs",
            scope: () => ({
              Input
            }),
          });
        `);
      });

      test('ambiguous invocation of built-in helper', async function () {
        givenFiles({
          'templates/application.hbs': `{{get this "stuff"}}`,
        });

        await configure({ staticInvokables: true });

        (await expectTranspiled('./templates/application.hbs')).equalsCode(`
          import { precompileTemplate } from "@ember/template-compilation";
          import { get } from "@ember/helper";
          export default precompileTemplate("{{get this \\"stuff\\"}}", {
            moduleName: "my-app/templates/application.hbs",
            scope: () => ({
              get
            }),
          });
        `);
      });

      test('component helper with direct addon package reference', async function () {
        givenFiles({
          'templates/application.hbs': `{{component "my-addon@thing"}}`,
        });
        await configure({ staticInvokables: true });
        (await expectTranspiled('templates/application.hbs')).equalsCode(`
        import { precompileTemplate } from "@ember/template-compilation";
        import thing_ from "@embroider/virtual/components/my-addon@thing";
        export default precompileTemplate("{{component thing_}}", {
          moduleName: "my-app/templates/application.hbs",
          scope: () => ({
            thing_
          })
        });
      `);
      });

      test('angle bracket invocation of component with @ syntax', async function () {
        givenFiles({
          'templates/application.hbs': `<MyAddon$Thing />`,
        });
        await configure(
          {
            staticInvokables: true,
          },
          {
            astPlugins: ['@embroider/test-support/example-template-namespacing-plugin.js'],
          }
        );
        (await expectTranspiled('templates/application.hbs')).equalsCode(`
          import { precompileTemplate } from "@ember/template-compilation";
          import Thing from "@embroider/virtual/components/my-addon@thing";
          export default precompileTemplate("<Thing />", {
            moduleName: "my-app/templates/application.hbs",
            scope: () => ({
              Thing
            })
          });
      `);
      });

      test('helper with @ syntax', async function () {
        givenFiles({
          'templates/application.hbs': `{{ (my-addon$thing) }}`,
        });
        await configure(
          {
            staticInvokables: true,
          },
          {
            astPlugins: ['@embroider/test-support/example-template-namespacing-plugin.js'],
          }
        );
        (await expectTranspiled('templates/application.hbs')).equalsCode(`
          import { precompileTemplate } from "@ember/template-compilation";
          import thing_ from "@embroider/virtual/helpers/my-addon@thing";
          export default precompileTemplate("{{(thing_)}}", {
            moduleName: "my-app/templates/application.hbs",
            scope: () => ({
              thing_
            })
          });
      `);
      });

      test('helper containing $', async function () {
        givenFiles({
          'templates/application.hbs': `{{ ($helper) }}`,
        });
        await configure({
          staticInvokables: true,
        });
        (await expectTranspiled('templates/application.hbs')).equalsCode(`
          import { precompileTemplate } from "@ember/template-compilation";
          import $helper from "@embroider/virtual/helpers/$helper";
          export default precompileTemplate("{{($helper)}}", {
            moduleName: "my-app/templates/application.hbs",
            scope: () => ({
              $helper
            })
          });
      `);
      });

      test('unsafe dynamic component in content position', async function () {
        givenFiles({
          'templates/application.hbs': `{{component this.which}}`,
        });
        await configure({ staticInvokables: true });
        (await expectTranspiled('templates/application.hbs')).failsToTransform(
          `Unsafe dynamic component: this.which in templates${sep}application.hbs`
        );
      });

      test('rejects arbitrary expression in component helper', async function () {
        givenFiles({
          'templates/application.hbs': `{{component (some-helper this.which)}}`,
        });
        await configure({ staticInvokables: true });
        (await expectTranspiled('templates/application.hbs')).failsToTransform(
          'Unsafe dynamic component: cannot statically analyze this expression'
        );
      });

      test('trusts inline ensure-safe-component helper', async function () {
        givenFiles({
          'templates/application.hbs': `{{component (ensure-safe-component this.which)}}`,
        });
        await configure({ staticInvokables: true });
        (await expectTranspiled('templates/application.hbs')).equalsCode(`
          import { precompileTemplate } from "@ember/template-compilation";
          import ensureSafeComponent from "@embroider/virtual/helpers/ensure-safe-component";
          export default precompileTemplate("{{component (ensureSafeComponent this.which)}}", {
            moduleName: "my-app/templates/application.hbs",
            scope: () => ({
              ensureSafeComponent,
            }),
          });
        `);
      });

      test('ignores any non-string-literal expression in "helper" keyword', async function () {
        givenFiles({
          'templates/application.hbs': `{{helper this.which}}`,
        });
        await configure({ staticInvokables: true });
        (await expectTranspiled('templates/application.hbs')).equalsCode(`
          import { precompileTemplate } from "@ember/template-compilation";
          export default precompileTemplate("{{helper this.which}}", {
            moduleName: "my-app/templates/application.hbs"
          });
        `);
      });

      test('ignores any non-string-literal expression in "modifier" keyword', async function () {
        givenFiles({
          'templates/application.hbs': `<div {{(modifier this.which)}} />`,
        });
        await configure({ staticInvokables: true });
        (await expectTranspiled('templates/application.hbs')).equalsCode(`
          import { precompileTemplate } from "@ember/template-compilation";
          export default precompileTemplate("<div {{(modifier this.which)}} />", {
            moduleName: "my-app/templates/application.hbs"
          });
        `);
      });

      test('leaves strict mode templates alone', async function () {
        // strict mode templates don't need our resolver transform at all, because
        // they don't do any global resolution.
        givenFiles({
          'templates/application.hbs.js': `
          import { precompileTemplate } from '@ember/template-compilation';
          export default precompileTemplate("<Thing />", {
            strictMode: true,
          });
        `,
        });
        await configure({
          staticInvokables: true,
        });
        (await expectTranspiled('templates/application.hbs.js')).equalsCode(`
          import { precompileTemplate } from '@ember/template-compilation';
          export default precompileTemplate("<Thing />", {
            strictMode: true,
          });
      `);
      });

      test('respects lexically scoped component', async function () {
        givenFiles({
          'templates/application.hbs.js': `
          import { precompileTemplate } from '@ember/template-compilation';
          export default precompileTemplate("<Thing />", {
            scope: () => ({ Thing }),
          });
        `,
        });
        await configure({
          staticInvokables: true,
        });
        (await expectTranspiled('templates/application.hbs.js')).equalsCode(`
          import { precompileTemplate } from '@ember/template-compilation';
          export default precompileTemplate("<Thing />", {
            scope: () => ({ Thing }),
          });
        `);
      });

      test('respects lexically scoped helper', async function () {
        givenFiles({
          'templates/application.hbs.js': `
          import { precompileTemplate } from '@ember/template-compilation';
          export default precompileTemplate("{{(thing)}}", {
            scope: () => ({ thing }),
          });
        `,
        });
        await configure({
          staticInvokables: true,
        });
        (await expectTranspiled('templates/application.hbs.js')).equalsCode(`
          import { precompileTemplate } from '@ember/template-compilation';
          export default precompileTemplate("{{(thing)}}", {
            scope: () => ({ thing }),
          });
        `);
      });

      test('local binding takes precedence over helper', async function () {
        givenFiles({
          'templates/application.hbs.js': `
          import { precompileTemplate } from '@ember/template-compilation';
          export default precompileTemplate("{{#each things as |capitalize|}} {{(capitalize)}} {{/each}}", {
            scope: () => ({ things }),
          });
        `,
        });
        await configure({
          staticInvokables: true,
        });
        (await expectTranspiled('templates/application.hbs.js')).equalsCode(`
          import { precompileTemplate } from '@ember/template-compilation';
          export default precompileTemplate("{{#each things as |capitalize|}} {{(capitalize)}} {{/each}}", {
            scope: () => ({ things }),
          });
        `);
      });

      test('local binding takes precedence over component', async function () {
        givenFiles({
          'templates/application.hbs.js': `
          import { precompileTemplate } from '@ember/template-compilation';
          export default precompileTemplate("{{#each things as |capitalize|}} <capitalize /> {{/each}}", {
            scope: () => ({ things }),
          });
        `,
        });
        await configure({
          staticInvokables: true,
        });
        (await expectTranspiled('templates/application.hbs.js')).equalsCode(`
          import { precompileTemplate } from '@ember/template-compilation';
          export default precompileTemplate("{{#each things as |capitalize|}} <capitalize /> {{/each}}", {
            scope: () => ({ things }),
          });
        `);
      });

      test('local binding takes precedence over modifier', async function () {
        givenFiles({
          'templates/application.hbs.js': `
          import { precompileTemplate } from '@ember/template-compilation';
          export default precompileTemplate("{{#each things as |capitalize|}} <div {{capitalize}} /> {{/each}}", {
            scope: () => ({ things }),
          });
        `,
        });
        await configure({
          staticInvokables: true,
        });
        (await expectTranspiled('templates/application.hbs.js')).equalsCode(`
          import { precompileTemplate } from '@ember/template-compilation';
          export default precompileTemplate("{{#each things as |capitalize|}} <div {{capitalize}} /> {{/each}}", {
            scope: () => ({ things }),
          });
        `);
      });

      test('local binding takes precedence over ambiguous form', async function () {
        givenFiles({
          'templates/application.hbs.js': `
          import { precompileTemplate } from '@ember/template-compilation';
          export default precompileTemplate("{{#each things as |capitalize|}} {{capitalize 1}} {{/each}}", {
            scope: () => ({ things }),
          });
        `,
        });
        await configure({
          staticInvokables: true,
        });
        (await expectTranspiled('templates/application.hbs.js')).equalsCode(`
          import { precompileTemplate } from '@ember/template-compilation';
          export default precompileTemplate("{{#each things as |capitalize|}} {{capitalize 1}} {{/each}}", {
            scope: () => ({ things }),
          });
        `);
      });

      test('local binding only applies within block', async function () {
        givenFiles({
          'templates/application.hbs': `
          {{#each things as |capitalize|}} {{(capitalize)}} {{/each}} {{(capitalize)}}
          <Form as |validate|><input {{validate}} /></Form> <input {{validate}} />
          `,
        });
        await configure({
          staticInvokables: true,
        });
        (await expectTranspiled('templates/application.hbs')).equalsCode(`
        import { precompileTemplate } from "@ember/template-compilation";
        import capitalize_ from "@embroider/virtual/helpers/capitalize";
        import Form from "@embroider/virtual/components/form";
        import validate_ from "@embroider/virtual/modifiers/validate";
        export default precompileTemplate("\\n          {{#each things as |capitalize|}} {{(capitalize)}} {{/each}} {{(capitalize_)}}\\n          <Form as |validate|><input {{validate}} /></Form> <input {{validate_}} />\\n          ", {
          moduleName: "my-app/templates/application.hbs",
          scope: () => ({
            capitalize_,
            Form,
            validate_
          })
        });
      `);
      });

      test('ignores dot-rule curl component invocation', async function () {
        givenFiles({
          'templates/application.hbs': `{{thing.body x=1}}{{#thing.body}}{{/thing.body}}`,
        });
        await configure({
          staticInvokables: true,
        });
        (await expectTranspiled('templates/application.hbs')).equalsCode(`
        import { precompileTemplate } from "@ember/template-compilation";
        export default precompileTemplate("{{thing.body x=1}}{{#thing.body}}{{/thing.body}}", {
          moduleName: "my-app/templates/application.hbs"
        });
      `);
      });

      test('respects yieldsSafeComponents rule, position 0', async function () {
        givenFiles({
          'templates/application.hbs': `{{#form-builder as |field|}}{{component field}}{{/form-builder}}`,
        });
        await configure(
          {
            staticInvokables: true,
          },
          {
            appPackageRules: {
              components: {
                '<FormBuilder />': {
                  yieldsSafeComponents: [true],
                },
              },
            },
          }
        );
        (await expectTranspiled('templates/application.hbs')).equalsCode(`
        import { precompileTemplate } from "@ember/template-compilation";
        import formBuilder from "@embroider/virtual/components/form-builder";
        export default precompileTemplate("{{#formBuilder as |field|}}{{component field}}{{/formBuilder}}", {
          moduleName: "my-app/templates/application.hbs",
          scope: () => ({
            formBuilder
          })
        });
      `);
      });

      test('respects yieldsSafeComponents rule, position 1', async function () {
        givenFiles({
          'templates/application.hbs': `{{#form-builder as |other field|}}{{component field}}{{/form-builder}}`,
        });
        await configure(
          {
            staticInvokables: true,
          },
          {
            appPackageRules: {
              components: {
                '<FormBuilder />': {
                  yieldsSafeComponents: [false, true],
                },
              },
            },
          }
        );
        (await expectTranspiled('templates/application.hbs')).equalsCode(`
        import { precompileTemplate } from "@ember/template-compilation";
        import formBuilder from "@embroider/virtual/components/form-builder";
        export default precompileTemplate("{{#formBuilder as |other field|}}{{component field}}{{/formBuilder}}", {
          moduleName: "my-app/templates/application.hbs",
          scope: () => ({
            formBuilder
          })
        });
      `);
      });

      test('respects yieldsSafeComponents rule, position 0.field', async function () {
        givenFiles({
          'templates/application.hbs': `{{#form-builder as |f|}}{{component f.field}}{{/form-builder}}`,
        });
        await configure(
          {
            staticInvokables: true,
          },
          {
            appPackageRules: {
              components: {
                '<FormBuilder />': {
                  yieldsSafeComponents: [{ field: true }],
                },
              },
            },
          }
        );
        (await expectTranspiled('templates/application.hbs')).equalsCode(`
        import { precompileTemplate } from "@ember/template-compilation";
        import formBuilder from "@embroider/virtual/components/form-builder";
        export default precompileTemplate("{{#formBuilder as |f|}}{{component f.field}}{{/formBuilder}}", {
          moduleName: "my-app/templates/application.hbs",
          scope: () => ({
            formBuilder
          })
        });
      `);
      });

      test('respects yieldsSafeComponents rule on element', async function () {
        givenFiles({
          'templates/application.hbs': `<FormBuilder as |field|>{{component field}}</FormBuilder>`,
        });
        await configure(
          {
            staticInvokables: true,
          },
          {
            appPackageRules: {
              components: {
                '<FormBuilder />': {
                  yieldsSafeComponents: [true],
                },
              },
            },
          }
        );
        (await expectTranspiled('templates/application.hbs')).equalsCode(`
        import { precompileTemplate } from "@ember/template-compilation";
        import FormBuilder from "@embroider/virtual/components/form-builder";
        export default precompileTemplate("<FormBuilder as |field|>{{component field}}</FormBuilder>", {
          moduleName: "my-app/templates/application.hbs",
          scope: () => ({
            FormBuilder
          })
        });
      `);
      });

      test('acceptsComponentArguments on mustache with literal', async function () {
        givenFiles({
          'templates/application.hbs': `{{form-builder title="fancy-title"}}`,
        });
        await configure(
          {
            staticInvokables: true,
          },
          {
            appPackageRules: {
              components: {
                '<FormBuilder />': {
                  acceptsComponentArguments: ['title'],
                },
              },
            },
          }
        );
        (await expectTranspiled('templates/application.hbs')).equalsCode(`
        import { precompileTemplate } from "@ember/template-compilation";
        import formBuilder from "@embroider/virtual/ambiguous/form-builder";
        import fancyTitle from "@embroider/virtual/components/fancy-title";
        export default precompileTemplate("{{formBuilder title=fancyTitle}}", {
          moduleName: "my-app/templates/application.hbs",
          scope: () => ({
            formBuilder,
            fancyTitle
          })
        });
      `);
      });

      test('acceptsComponentArguments on mustache block with literal', async function () {
        givenFiles({
          'templates/application.hbs': `{{#form-builder title="fancy-title"}}{{/form-builder}}`,
        });
        await configure(
          {
            staticInvokables: true,
          },
          {
            appPackageRules: {
              components: {
                '<FormBuilder />': {
                  acceptsComponentArguments: ['title'],
                },
              },
            },
          }
        );
        (await expectTranspiled('templates/application.hbs')).equalsCode(`
        import { precompileTemplate } from "@ember/template-compilation";
        import formBuilder from "@embroider/virtual/components/form-builder";
        import fancyTitle from "@embroider/virtual/components/fancy-title";
        export default precompileTemplate("{{#formBuilder title=fancyTitle}}{{/formBuilder}}", {
          moduleName: "my-app/templates/application.hbs",
          scope: () => ({
            formBuilder,
            fancyTitle
          })
        });
      `);
      });

      test('acceptsComponentArguments on element with literal', async function () {
        givenFiles({
          'templates/application.hbs': `<FormBuilder @title="fancy-title"></FormBuilder>`,
        });
        await configure(
          {
            staticInvokables: true,
          },
          {
            appPackageRules: {
              components: {
                '<FormBuilder />': {
                  acceptsComponentArguments: ['title'],
                },
              },
            },
          }
        );
        (await expectTranspiled('templates/application.hbs')).equalsCode(`
        import { precompileTemplate } from "@ember/template-compilation";
        import FormBuilder from "@embroider/virtual/components/form-builder";
        import fancyTitle from "@embroider/virtual/components/fancy-title";
        export default precompileTemplate("<FormBuilder @title={{fancyTitle}}></FormBuilder>", {
          moduleName: "my-app/templates/application.hbs",
          scope: () => ({
            FormBuilder,
            fancyTitle
          })
        });
      `);
      });

      test('acceptsComponentArguments argument name may include optional @', async function () {
        givenFiles({
          'templates/application.hbs': `{{form-builder title="fancy-title"}}`,
        });
        await configure(
          {
            staticInvokables: true,
          },
          {
            appPackageRules: {
              components: {
                '<FormBuilder />': {
                  acceptsComponentArguments: ['@title'],
                },
              },
            },
          }
        );
        (await expectTranspiled('templates/application.hbs')).equalsCode(`
        import { precompileTemplate } from "@ember/template-compilation";
        import formBuilder from "@embroider/virtual/ambiguous/form-builder";
        import fancyTitle from "@embroider/virtual/components/fancy-title";
        export default precompileTemplate("{{formBuilder title=fancyTitle}}", {
          moduleName: "my-app/templates/application.hbs",
          scope: () => ({
            formBuilder,
            fancyTitle
          })
        });
      `);
      });

      test('acceptsComponentArguments on mustache with component subexpression', async function () {
        givenFiles({
          'templates/application.hbs': `{{form-builder title=(component "fancy-title")}}`,
        });
        await configure(
          {
            staticInvokables: true,
          },
          {
            appPackageRules: {
              components: {
                '<FormBuilder />': {
                  acceptsComponentArguments: ['@title'],
                },
              },
            },
          }
        );
        (await expectTranspiled('templates/application.hbs')).equalsCode(`
        import { precompileTemplate } from "@ember/template-compilation";
        import formBuilder from "@embroider/virtual/ambiguous/form-builder";
        import fancyTitle from "@embroider/virtual/components/fancy-title";
        export default precompileTemplate("{{formBuilder title=(component fancyTitle)}}", {
          moduleName: "my-app/templates/application.hbs",
          scope: () => ({
            formBuilder,
            fancyTitle
          })
        });
      `);
      });

      test('acceptsComponentArguments on element with component helper mustache', async function () {
        givenFiles({
          'templates/application.hbs': `<FormBuilder @title={{component "fancy-title"}} />`,
        });
        await configure(
          {
            staticInvokables: true,
          },
          {
            appPackageRules: {
              components: {
                '<FormBuilder />': {
                  acceptsComponentArguments: ['@title'],
                },
              },
            },
          }
        );
        (await expectTranspiled('templates/application.hbs')).equalsCode(`
        import { precompileTemplate } from "@ember/template-compilation";
        import FormBuilder from "@embroider/virtual/components/form-builder";
        import fancyTitle from "@embroider/virtual/components/fancy-title";
        export default precompileTemplate("<FormBuilder @title={{component fancyTitle}} />", {
          moduleName: "my-app/templates/application.hbs",
          scope: () => ({
            FormBuilder,
            fancyTitle
          })
        });
      `);
      });

      test(`acceptsComponentArguments interior usage generates no warning`, async function () {
        givenFiles({
          'components/form-builder.hbs': `{{component @title}}{{component title}}{{component this.title}}`,
        });
        await configure(
          { staticInvokables: true },
          {
            appPackageRules: {
              components: {
                '<FormBuilder />': {
                  acceptsComponentArguments: ['title'],
                },
              },
            },
          }
        );
        (await expectTranspiled('components/form-builder.hbs')).equalsCode(`
          import { precompileTemplate } from "@ember/template-compilation";
          export default precompileTemplate("{{component @title}}{{component title}}{{component this.title}}", {
            moduleName: "my-app/components/form-builder.hbs"
          });
        `);
      });

      test('respects yieldsArguments rule for positional block param, angle', async function () {
        givenFiles({
          'components/form-builder.hbs': `
        <FormBuilder @navbar={{component "fancy-navbar"}} as |bar|>
          {{component bar}}
        </FormBuilder>`,
        });
        await configure(
          { staticInvokables: true },
          {
            appPackageRules: {
              components: {
                '<FormBuilder />': {
                  yieldsArguments: ['navbar'],
                },
              },
            },
          }
        );
        (await expectTranspiled('components/form-builder.hbs')).equalsCode(`
        import { precompileTemplate } from "@ember/template-compilation";
        import FormBuilder from "@embroider/virtual/components/form-builder";
        import fancyNavbar from "@embroider/virtual/components/fancy-navbar";
        export default precompileTemplate("\\n        <FormBuilder @navbar={{component fancyNavbar}} as |bar|>\\n          {{component bar}}\\n        </FormBuilder>", {
          moduleName: "my-app/components/form-builder.hbs",
          scope: () => ({
            FormBuilder,
            fancyNavbar
          })
        });
      `);
      });

      test('respects yieldsArguments rule for positional block param, curly', async function () {
        givenFiles({
          'components/form-builder.hbs': `
        {{#form-builder navbar=(component "fancy-navbar") as |bar|}}
          {{component bar}}
        {{/form-builder}}`,
        });
        await configure(
          { staticInvokables: true },
          {
            appPackageRules: {
              components: {
                '<FormBuilder />': {
                  yieldsArguments: ['navbar'],
                },
              },
            },
          }
        );
        (await expectTranspiled('components/form-builder.hbs')).equalsCode(`
        import { precompileTemplate } from "@ember/template-compilation";
        import formBuilder from "@embroider/virtual/components/form-builder";
        import fancyNavbar from "@embroider/virtual/components/fancy-navbar";
        export default precompileTemplate("\\n        {{#formBuilder navbar=(component fancyNavbar) as |bar|}}\\n          {{component bar}}\\n        {{/formBuilder}}", {
          moduleName: "my-app/components/form-builder.hbs",
          scope: () => ({
            formBuilder,
            fancyNavbar
          })
        });
      `);
      });

      test('respects yieldsArguments rule for hash block param', async function () {
        givenFiles({
          'components/form-builder.hbs': `
        {{#form-builder navbar=(component "fancy-navbar") as |f|}}
          {{component f.bar}}
        {{/form-builder}}`,
        });
        await configure(
          { staticInvokables: true },
          {
            appPackageRules: {
              components: {
                '<FormBuilder />': {
                  yieldsArguments: [{ bar: 'navbar' }],
                },
              },
            },
          }
        );
        (await expectTranspiled('components/form-builder.hbs')).equalsCode(`
        import { precompileTemplate } from "@ember/template-compilation";
        import formBuilder from "@embroider/virtual/components/form-builder";
        import fancyNavbar from "@embroider/virtual/components/fancy-navbar";
        export default precompileTemplate("\\n        {{#formBuilder navbar=(component fancyNavbar) as |f|}}\\n          {{component f.bar}}\\n        {{/formBuilder}}", {
          moduleName: "my-app/components/form-builder.hbs",
          scope: () => ({
            formBuilder,
            fancyNavbar
          })
        });
      `);
      });

      test('yieldsArguments causes warning to propagate up lexically, angle', async function () {
        givenFiles({
          'components/form-builder.hbs': `
        <FormBuilder @navbar={{this.unknown}} as |bar|>
          {{component bar}}
        </FormBuilder>`,
        });
        await configure(
          { staticInvokables: true },
          {
            appPackageRules: {
              components: {
                '<FormBuilder />': {
                  yieldsArguments: ['navbar'],
                },
              },
            },
          }
        );
        (await expectTranspiled('components/form-builder.hbs')).failsToTransform(
          `argument "navbar" to component "FormBuilder" is treated as a component, but the value you're passing is dynamic: this.unknown`
        );
      });

      test('yieldsArguments causes warning to propagate up lexically, curl', async function () {
        givenFiles({
          'components/form-builder.hbs': `
        {{#form-builder navbar=this.unknown as |bar|}}
          {{component bar}}
        {{/form-builder}}`,
        });
        await configure(
          { staticInvokables: true },
          {
            appPackageRules: {
              components: {
                '<FormBuilder />': {
                  yieldsArguments: ['navbar'],
                },
              },
            },
          }
        );
        (await expectTranspiled('components/form-builder.hbs')).failsToTransform(
          `argument "navbar" to component "form-builder" is treated as a component, but the value you're passing is dynamic: this.unknown`
        );
      });

      test('yieldsArguments causes warning to propagate up lexically, multiple levels', async function () {
        givenFiles({
          'components/form-builder.hbs': `
          {{#form-builder navbar=this.unknown as |bar1|}}
            {{#form-builder navbar=bar1 as |bar2|}}
              {{component bar2}}
            {{/form-builder}}
          {{/form-builder}}
          `,
        });
        await configure(
          { staticInvokables: true },
          {
            appPackageRules: {
              components: {
                '<FormBuilder />': {
                  yieldsArguments: ['navbar'],
                },
              },
            },
          }
        );
        (await expectTranspiled('components/form-builder.hbs')).failsToTransform(
          `argument "navbar" to component "form-builder" is treated as a component, but the value you're passing is dynamic: this.unknown`
        );
      });

      test('respects invokes rule on a component', async function () {
        givenFiles({
          'components/my-thing.hbs': `{{component this.which}}`,
        });
        await configure(
          { staticInvokables: true },
          {
            appPackageRules: {
              components: {
                '<MyThing/>': {
                  invokes: { 'this.which': ['<Alpha/>'] },
                },
              },
            },
          }
        );

        (await expectTranspiled('components/my-thing.hbs')).equalsCode(`
          import { precompileTemplate } from "@ember/template-compilation";
          let registerComponents = class extends Helper {
            compute(_positional, registrations) {
              let owner = getOwner(this);
              for (let [name, definition] of Object.entries(registrations)) {
                owner.register(\`component:\${name}\`, definition);
              }
            }
          };
          import alpha_ from "@embroider/virtual/components/alpha";
          import Helper from "@ember/component/helper";
          import { getOwner } from "@ember/owner";
          export default precompileTemplate("{{registerComponents alpha=alpha_}}{{component this.which}}", {
            moduleName: "my-app/components/my-thing.hbs",
            scope: () => ({
              alpha_,
              registerComponents
            })
          });
        `);
      });

      test('respects invokes rule on a non-component app template', async function () {
        givenFiles({
          'templates/index.hbs': `{{component this.which}}`,
        });
        await configure(
          { staticInvokables: true },
          {
            appPackageRules: {
              appTemplates: {
                'templates/index.hbs': {
                  invokes: { 'this.which': ['<Alpha/>'] },
                },
              },
            },
          }
        );

        (await expectTranspiled('templates/index.hbs')).equalsCode(`
          import { precompileTemplate } from "@ember/template-compilation";
          let registerComponents = class extends Helper {
            compute(_positional, registrations) {
              let owner = getOwner(this);
              for (let [name, definition] of Object.entries(registrations)) {
                owner.register(\`component:\${name}\`, definition);
              }
            }
          };
          import alpha_ from "@embroider/virtual/components/alpha";
          import Helper from "@ember/component/helper";
          import { getOwner } from "@ember/owner";
          export default precompileTemplate(
            "{{registerComponents alpha=alpha_}}{{component this.which}}",
            {
              moduleName: "my-app/templates/index.hbs",
              scope: () => ({
                alpha_,
                registerComponents,
              }),
            }
          );
       `);
      });

      test(`respects element block params scope boundary`, async function () {
        givenFiles({
          'templates/application.hbs': `<Example @arg={{(title)}} as |title|>{{(title)}}</Example>`,
        });
        await configure({ staticInvokables: true });
        (await expectTranspiled('templates/application.hbs')).equalsCode(`
          import { precompileTemplate } from "@ember/template-compilation";
          import Example from "@embroider/virtual/components/example";
          import title_ from "@embroider/virtual/helpers/title";
          export default precompileTemplate("<Example @arg={{(title_)}} as |title|>{{(title)}}</Example>", {
            moduleName: "my-app/templates/application.hbs",
            scope: () => ({
              Example,
              title_
            })
          });
        `);
      });

      test(`respects mustache block params scope boundary`, async function () {
        givenFiles({
          'templates/application.hbs': `{{#example arg=(title) as |title|}}{{(title)}}{{/example}}`,
        });
        await configure({ staticInvokables: true });
        (await expectTranspiled('templates/application.hbs')).equalsCode(`
          import { precompileTemplate } from "@ember/template-compilation";
          import example_ from "@embroider/virtual/components/example";
          import title_ from "@embroider/virtual/helpers/title";
          export default precompileTemplate("{{#example_ arg=(title_) as |title|}}{{(title)}}{{/example_}}", {
            moduleName: "my-app/templates/application.hbs",
            scope: () => ({
              example_,
              title_
            })
          });
        `);
      });
    });
  });
