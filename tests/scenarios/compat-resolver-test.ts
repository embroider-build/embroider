import { AppMeta } from '@embroider/shared-internals';
import { Transpiler } from '@embroider/test-support';
import { ExpectFile, expectFilesAt } from '@embroider/test-support/file-assertions/qunit';
import { outputFileSync } from 'fs-extra';
import { resolve } from 'path';
import type { Options as EtcOptions } from 'babel-plugin-ember-template-compilation';

import QUnit from 'qunit';
import { Project, Scenarios } from 'scenario-tester';
import { CompatResolverOptions } from '@embroider/compat/src/resolver-transform';
import { PackageRules } from '@embroider/compat';

// installs our assert.audit QUnit helper
import '@embroider/test-support/audit-assertions';

const { module: Qmodule, test } = QUnit;

Scenarios.fromProject(() => new Project())
  .map('compat-resolver-test', app => {
    let appMeta: AppMeta = {
      type: 'app',
      version: 2,
      'auto-upgraded': true,
      assets: ['index.html'],
      'root-url': '/',
      babel: {
        majorVersion: 7,
        filename: '_babel_config.js',
        isParallelSafe: true,
        fileFilter: '_babel_filter.js',
      },
    };
    app.pkg = {
      name: 'my-app',
      keywords: ['ember-addon'],
      'ember-addon': appMeta,
    };
    app.mergeFiles({
      'index.html': '<script src="./templates/application.hbs" type="module"></script>',
    });
  })
  .forEachScenario(scenario => {
    Qmodule(scenario.name, function (hooks) {
      let expectTranspiled: (file: string) => ReturnType<ReturnType<ExpectFile>['transform']>;
      let givenFiles: (files: Record<string, string>) => void;
      let configure: (
        opts?: Partial<CompatResolverOptions['options']>,
        extraOpts?: { appPackageRules?: Partial<PackageRules> }
      ) => Promise<void>;

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
          extraOpts?: { appPackageRules?: Partial<PackageRules> }
        ) {
          let etcOptions: EtcOptions = {
            compilerPath: require.resolve('ember-source/dist/ember-template-compiler'),
            targetFormat: 'hbs',
            transforms: [[require.resolve('@embroider/compat/src/resolver-transform'), { appRoot: app.dir }]],
          };

          let resolverOptions: CompatResolverOptions = {
            activeAddons: {},
            renameModules: {},
            renamePackages: {},
            extraImports: {},
            relocatedFiles: {},
            resolvableExtensions: ['.js', '.hbs'],
            appRoot: app.dir,
            engines: [
              {
                packageName: 'my-app',
                root: app.dir,
                activeAddons: [],
              },
            ],
            modulePrefix: 'my-app',
            podModulePrefix: undefined,
            options: {
              staticComponents: false,
              staticHelpers: false,
              staticModifiers: false,
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
          };

          givenFiles({
            '_babel_config.js': `
            module.exports = {
              plugins: [
                [
                  "${require.resolve('babel-plugin-ember-template-compilation')}",
                  ${JSON.stringify(etcOptions)}
                ],
              ]
            }
            `,
            '_babel_filter.js': `
              module.exports = function(filename) { return true }
            `,
            '.embroider/resolver.json': JSON.stringify(resolverOptions),
          });
        };
      });

      test('emits no components when staticComponents is off', async function () {
        givenFiles({
          'components/hello-world.js': '',
          'templates/application.hbs': `{{hello-world}} <HelloWorld />`,
        });
        await configure();
        expectTranspiled('./templates/application.hbs').equalsCode(`
        import { precompileTemplate } from "@ember/template-compilation";
        export default precompileTemplate("{{hello-world}} <HelloWorld />", {
          moduleName: "my-app/templates/application.hbs",
        });`);
      });

      test('bare dasherized component with no args is ambiguous', async function () {
        givenFiles({
          'templates/application.hbs': `{{hello-world}}`,
        });

        await configure({ staticComponents: true });

        expectTranspiled('./templates/application.hbs').failsToTransform(`"{{hello-world}}" is ambiguous`);
      });

      test('bare dasherized component in ambiguous position requires staticHelpers to agree ', async function () {
        givenFiles({
          'templates/application.hbs': `{{hello-world arg=1}}`,
        });

        await configure({ staticComponents: true });

        expectTranspiled('templates/application.hbs').failsToTransform(
          `this use of "{{hello-world}}" could be helper "{{ (hello-world) }}" or component "<HelloWorld />", and your settings for staticHelpers and staticComponents do not agree`
        );
      });

      test('bare dasherized component manually disambiguated to component', async function () {
        givenFiles({
          'templates/application.hbs': `{{hello-world}}`,
        });

        await configure(
          { staticComponents: true, staticHelpers: true },
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

        expectTranspiled('./templates/application.hbs').equalsCode(`
            import helloWorld_ from "#embroider_compat/components/hello-world";
            import { precompileTemplate } from "@ember/template-compilation";
            export default precompileTemplate("{{helloWorld_}}", {
              moduleName: "my-app/templates/application.hbs",
              scope: () => ({
                helloWorld_
              }),
            });
        `);
      });

      test('bare dasherized component with arg', async function () {
        givenFiles({
          'templates/application.hbs': `{{hello-world arg=1}}`,
        });

        await configure({ staticComponents: true, staticHelpers: true });

        expectTranspiled('templates/application.hbs').equalsCode(`
            import helloWorld_ from "#embroider_compat/ambiguous/hello-world";
            import { precompileTemplate } from "@ember/template-compilation";
            export default precompileTemplate("{{helloWorld_ arg=1}}", {
              moduleName: "my-app/templates/application.hbs",
              scope: () => ({
                helloWorld_
              }),
            });
        `);
      });

      test('bare dasherized helper with arg', async function () {
        givenFiles({
          'templates/application.hbs': `{{hello-world arg=1}}`,
        });

        await configure({ staticComponents: true, staticHelpers: true });

        expectTranspiled('templates/application.hbs').equalsCode(`
            import helloWorld_ from "#embroider_compat/ambiguous/hello-world";
            import { precompileTemplate } from "@ember/template-compilation";
            export default precompileTemplate("{{helloWorld_ arg=1}}", {
              moduleName: "my-app/templates/application.hbs",
              scope: () => ({
                helloWorld_
              }),
            });
        `);
      });

      test('nested bare dasherized component', async function () {
        givenFiles({
          'templates/application.hbs': `{{something/hello-world}}`,
        });
        await configure({ staticComponents: true, staticHelpers: true });
        expectTranspiled('templates/application.hbs').equalsCode(`
            import somethingHelloWorld_ from "#embroider_compat/ambiguous/something/hello-world";
            import { precompileTemplate } from "@ember/template-compilation";
            export default precompileTemplate("{{somethingHelloWorld_}}", {
              moduleName: "my-app/templates/application.hbs",
              scope: () => ({
                somethingHelloWorld_,
              }),
            });
        `);
      });

      test('coalesces repeated components', async function () {
        givenFiles({
          'templates/application.hbs': `<HelloWorld /><HelloWorld />`,
        });
        await configure({ staticComponents: true });
        expectTranspiled('templates/application.hbs').equalsCode(`
          import helloWorld_ from "#embroider_compat/components/hello-world";
          import { precompileTemplate } from "@ember/template-compilation";
          export default precompileTemplate("<helloWorld_ /><helloWorld_ />", {
            moduleName: "my-app/templates/application.hbs",
            scope: () => ({
              helloWorld_
            })
          });
        `);
      });

      test('tolerates non path mustaches', async function () {
        givenFiles({
          'templates/application.hbs': `<Thing @foo={{1}} />`,
        });
        await configure({
          staticComponents: true,
          staticHelpers: true,
          staticModifiers: true,
        });
        expectTranspiled('templates/application.hbs').equalsCode(`
          import thing_ from "#embroider_compat/components/thing";
          import { precompileTemplate } from "@ember/template-compilation";
          export default precompileTemplate("<thing_ @foo={{1}} />", {
            moduleName: "my-app/templates/application.hbs",
            scope: () => ({
              thing_
            })
          });
        `);
      });

      test('block form curly component', async function () {
        givenFiles({
          'templates/application.hbs': `{{#hello-world}} {{/hello-world}}`,
        });
        await configure({ staticComponents: true });
        expectTranspiled('templates/application.hbs').equalsCode(`
          import helloWorld_ from "#embroider_compat/components/hello-world";
          import { precompileTemplate } from "@ember/template-compilation";
          export default precompileTemplate("{{#helloWorld_}} {{/helloWorld_}}", {
            moduleName: "my-app/templates/application.hbs",
            scope: () => ({
              helloWorld_
            })
          });
        `);
      });

      test('block form angle component', async function () {
        givenFiles({
          'templates/application.hbs': `<HelloWorld></HelloWorld>`,
        });
        await configure({ staticComponents: true });
        expectTranspiled('templates/application.hbs').equalsCode(`
          import helloWorld_ from "#embroider_compat/components/hello-world";
          import { precompileTemplate } from "@ember/template-compilation";
          export default precompileTemplate("<helloWorld_></helloWorld_>", {
            moduleName: "my-app/templates/application.hbs",
            scope: () => ({
              helloWorld_
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
        await configure({ staticComponents: true, staticHelpers: true });
        expectTranspiled('templates/application.hbs.js').equalsCode(`
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
        await configure({ staticComponents: true, staticHelpers: true });
        expectTranspiled('templates/application.hbs.js').equalsCode(`
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
        await configure({ staticComponents: true, staticHelpers: true });
        expectTranspiled('templates/application.hbs.js').equalsCode(`
          import { precompileTemplate } from '@ember/template-compilation';
          precompileTemplate('<helloWorld as |h|> <h.title @flavor="chocolate" /> </helloWorld>', {
            scope: () => ({ helloWorld })
          });
        `);
      });

      test('optional component missing in mustache', async function () {
        givenFiles({
          'templates/application.hbs': `{{this-one x=true}}`,
        });
        await configure(
          { staticComponents: true, staticHelpers: true },
          {
            appPackageRules: {
              components: {
                '{{this-one}}': { safeToIgnore: true },
              },
            },
          }
        );
        expectTranspiled('templates/application.hbs').equalsCode(`
          import { precompileTemplate } from "@ember/template-compilation";
          export default precompileTemplate("{{this-one x=true}}", {
            moduleName: "my-app/templates/application.hbs"
          });
        `);
      });

      test('optional component missing in mustache block', async function () {
        givenFiles({
          'templates/application.hbs': `{{#this-one}} {{/this-one}}`,
        });
        await configure(
          { staticComponents: true, staticHelpers: true },
          {
            appPackageRules: {
              components: {
                '{{this-one}}': { safeToIgnore: true },
              },
            },
          }
        );
        expectTranspiled('templates/application.hbs').equalsCode(`
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
          { staticComponents: true, staticHelpers: true },
          {
            appPackageRules: {
              components: {
                '{{this-one}}': { safeToIgnore: true },
              },
            },
          }
        );
        expectTranspiled('templates/application.hbs').equalsCode(`
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
          { staticComponents: true, staticHelpers: true },
          {
            appPackageRules: {
              components: {
                '{{component "this-one"}}': { safeToIgnore: true },
              },
            },
          }
        );
        expectTranspiled('templates/application.hbs').equalsCode(`
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
          { staticComponents: true, staticHelpers: true },
          {
            appPackageRules: {
              components: {
                '<ThisOne />': { safeToIgnore: true },
              },
            },
          }
        );
        expectTranspiled('templates/application.hbs').equalsCode(`
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
          { staticComponents: true },
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

        expectTranspiled('templates/application.hbs').equalsCode(`          
          import secondTarget_ from "#embroider_compat/components/second-target";
          import firstTarget_ from "#embroider_compat/components/first-target";
          import helloWorld_ from "#embroider_compat/components/hello-world";
          import { precompileTemplate } from "@ember/template-compilation";
          export default precompileTemplate("<helloWorld_ @iAmAComponent={{firstTarget_}} /><helloWorld_ @iAmAComponent={{secondTarget_}} />", {
            moduleName: "my-app/templates/application.hbs",
            scope: () => ({
              helloWorld_,
              firstTarget_,
              secondTarget_,
            }),
          });
        `);
      });

      test('acceptsComponentArguments works on all copies of a lexically-inserted component, mustache block syntax', async function () {
        givenFiles({
          'templates/application.hbs': `{{#hello-world iAmAComponent='first-target' }}{{/hello-world}}{{#hello-world iAmAComponent='second-target' }}{{/hello-world}}`,
        });
        await configure(
          { staticComponents: true },
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

        expectTranspiled('templates/application.hbs').equalsCode(`          
          import secondTarget_ from "#embroider_compat/components/second-target";
          import firstTarget_ from "#embroider_compat/components/first-target";
          import helloWorld_ from "#embroider_compat/components/hello-world";
          import { precompileTemplate } from "@ember/template-compilation";
          export default precompileTemplate("{{#helloWorld_ iAmAComponent=firstTarget_}}{{/helloWorld_}}{{#helloWorld_ iAmAComponent=secondTarget_}}{{/helloWorld_}}", {
            moduleName: "my-app/templates/application.hbs",
            scope: () => ({
              helloWorld_,
              firstTarget_,
              secondTarget_,
            }),
          });
        `);
      });

      test('acceptsComponentArguments works on all copies of a lexically-inserted component, mustache syntax', async function () {
        givenFiles({
          'templates/application.hbs': `{{hello-world iAmAComponent='first-target' }}{{hello-world iAmAComponent='second-target' }}`,
        });
        await configure(
          { staticComponents: true, staticHelpers: true },
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

        expectTranspiled('templates/application.hbs').equalsCode(`          
          import secondTarget_ from "#embroider_compat/components/second-target";
          import firstTarget_ from "#embroider_compat/components/first-target";
          import helloWorld_ from "#embroider_compat/ambiguous/hello-world";
          import { precompileTemplate } from "@ember/template-compilation";
          export default precompileTemplate("{{helloWorld_ iAmAComponent=firstTarget_}}{{helloWorld_ iAmAComponent=secondTarget_}}", {
            moduleName: "my-app/templates/application.hbs",
            scope: () => ({
              helloWorld_,
              firstTarget_,
              secondTarget_,
            }),
          });
        `);
      });
    });
  });
