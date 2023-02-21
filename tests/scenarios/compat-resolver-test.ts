import { AppMeta } from '@embroider/shared-internals';
import { ExpectFile, expectFilesAt, Transpiler } from '@embroider/test-support';
import { outputFileSync } from 'fs-extra';
import { resolve } from 'path';
import type { Options as EtcOptions } from 'babel-plugin-ember-template-compilation';

import QUnit from 'qunit';
import { Project, Scenarios } from 'scenario-tester';
import { CompatResolverOptions } from '@embroider/compat/src/resolver-transform';
import { PackageRules } from '@embroider/compat';
import '@embroider/test-support/audit-assertions';
import { AuditBuildOptions } from '@embroider/compat/src/audit';

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
      let expectFile: ExpectFile;
      let build: Transpiler;
      let givenFiles: (files: Record<string, string>) => void;
      let configure: (
        opts?: Partial<CompatResolverOptions['options']>,
        extraOpts?: { appPackageRules?: Partial<PackageRules> }
      ) => void;

      let auditParams: AuditBuildOptions;

      hooks.beforeEach(async assert => {
        let app = await scenario.prepare();
        expectFile = expectFilesAt(app.dir, { qunit: assert });
        build = new Transpiler(app.dir);
        givenFiles = function (files: Record<string, string>) {
          for (let [filename, contents] of Object.entries(files)) {
            outputFileSync(resolve(app.dir, filename), contents, 'utf8');
          }
        };
        configure = function (
          opts?: Partial<CompatResolverOptions['options']>,
          extraOpts?: { appPackageRules?: Partial<PackageRules> }
        ) {
          let etcOptions: EtcOptions = {
            compilerPath: require.resolve('ember-source/dist/ember-template-compiler'),
            targetFormat: 'hbs',
            transforms: [[require.resolve('@embroider/compat/src/resolver-transform'), { appRoot: app.dir }]],
          };

          auditParams = {
            outputDir: app.dir,
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

      test('emits no components when staticComponents is off', function () {
        configure();
        givenFiles({
          'components/hello-world.js': '',
          'templates/application.hbs': `{{hello-world}} <HelloWorld />`,
        });
        expectFile('templates/application.hbs').transform(build.transpile).equalsCode(`
          import { precompileTemplate } from "@ember/template-compilation";
          export default precompileTemplate("{{hello-world}} <HelloWorld />", {
            moduleName: "my-app/templates/application.hbs",
          });`);
      });

      test('bare dasherized component with no args is ambiguous', function () {
        configure({ staticComponents: true });
        givenFiles({
          'components/hello-world.js': '',
          'templates/application.hbs': `{{hello-world}}`,
        });

        expectFile('templates/application.hbs')
          .transform(build.transpile)
          .failsToTransform(`"{{hello-world}}" is ambiguous`);
      });

      test('bare dasherized component in ambiguous position requires staticHelpers to agree ', function () {
        configure({ staticComponents: true });
        givenFiles({
          'components/hello-world.js': '',
          'templates/application.hbs': `{{hello-world arg=1}}`,
        });

        expectFile('templates/application.hbs')
          .transform(build.transpile)
          .failsToTransform(
            `this use of "{{hello-world}}" could be helper "{{ (hello-world) }}" or component "<HelloWorld />", and your settings for staticHelpers and staticComponents do not agree`
          );
      });

      test('bare dasherized component, js only, manually disambiguated to component', async function (assert) {
        configure(
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
        givenFiles({
          'components/hello-world.js': '',
          'templates/application.hbs': `{{hello-world}}`,
        });

        expectFile('templates/application.hbs').transform(build.transpile).equalsCode(`
            import helloWorld_ from "#embroider_compat/components/hello-world";
            import { precompileTemplate } from "@ember/template-compilation";
            export default precompileTemplate("{{helloWorld_}}", {
              moduleName: "my-app/templates/application.hbs",
              scope: () => ({
                helloWorld_
              }),
            });
        `);

        (await assert.audit(auditParams))
          .module('./templates/application.hbs')
          .resolves('#embroider_compat/components/hello-world')
          .to('./components/hello-world.js');
      });

      test('bare dasherized component, js only, with arg', async function (assert) {
        configure({ staticComponents: true, staticHelpers: true });
        givenFiles({
          'components/hello-world.js': '',
          'templates/application.hbs': `{{hello-world arg=1}}`,
        });

        expectFile('templates/application.hbs').transform(build.transpile).equalsCode(`
            import helloWorld_ from "#embroider_compat/ambiguous/hello-world";
            import { precompileTemplate } from "@ember/template-compilation";
            export default precompileTemplate("{{helloWorld_ arg=1}}", {
              moduleName: "my-app/templates/application.hbs",
              scope: () => ({
                helloWorld_
              }),
            });
        `);

        (await assert.audit(auditParams))
          .module('./templates/application.hbs')
          .resolves('#embroider_compat/ambiguous/hello-world')
          .to('./components/hello-world.js');
      });
    });
  });
