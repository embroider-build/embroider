import { AppMeta } from '@embroider/shared-internals';
import { outputFileSync } from 'fs-extra';
import { resolve } from 'path';
import QUnit from 'qunit';
import { Project, Scenarios } from 'scenario-tester';
import { CompatResolverOptions } from '@embroider/compat/src/resolver-transform';
import { ExpectAuditResults } from '@embroider/test-support/audit-assertions';

// installs our assert.audit QUnit helper
import '@embroider/test-support/audit-assertions';

const { module: Qmodule, test } = QUnit;

Scenarios.fromProject(() => new Project())
  .map('core-resolver-test', app => {
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
      'index.html': '<script src="./app.js" type="module"></script>',
    });
  })
  .forEachScenario(scenario => {
    Qmodule(scenario.name, function (hooks) {
      let expectAudit: ExpectAuditResults;
      let givenFiles: (files: Record<string, string>) => void;

      interface ConfigureOpts {
        podModulePrefix?: string;
      }

      let configure: (opts?: ConfigureOpts) => Promise<void>;

      hooks.beforeEach(async assert => {
        let app = await scenario.prepare();

        givenFiles = function (files: Record<string, string>) {
          for (let [filename, contents] of Object.entries(files)) {
            outputFileSync(resolve(app.dir, filename), contents, 'utf8');
          }
        };
        configure = async function (opts?: ConfigureOpts) {
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
            podModulePrefix: opts?.podModulePrefix,
            options: {
              staticComponents: false,
              staticHelpers: false,
              staticModifiers: false,
              allowUnsafeDynamicComponents: false,
            },
            activePackageRules: [
              {
                package: 'my-app',
                roots: [app.dir],
              },
            ],
          };

          givenFiles({
            '_babel_config.js': `
            module.exports = {
              plugins: []
            }
            `,
            '_babel_filter.js': `
              module.exports = function(filename) { return true }
            `,
            '.embroider/resolver.json': JSON.stringify(resolverOptions),
          });

          expectAudit = await assert.audit({ outputDir: app.dir });
        };
      });

      Qmodule('#embroider_compat', function () {
        test('js-only component', async function () {
          givenFiles({
            'components/hello-world.js': '',
            'app.js': `import "#embroider_compat/components/hello-world"`,
          });

          await configure();

          expectAudit
            .module('./app.js')
            .resolves('#embroider_compat/components/hello-world')
            .to('./components/hello-world.js');
        });

        test('js-and-hbs component', async function () {
          givenFiles({
            'components/hello-world.js': '',
            'templates/components/hello-world.hbs': '',
            'app.js': `import "#embroider_compat/components/hello-world"`,
          });

          await configure();

          let pairModule = expectAudit
            .module('./app.js')
            .resolves('#embroider_compat/components/hello-world')
            .toModule();

          pairModule.codeEquals(`
            import { setComponentTemplate } from "@ember/component";
            import template from "../../hello-world.hbs";
            import component from "../../../../components/hello-world.js";
            export default setComponentTemplate(template, component);
          `);

          pairModule.resolves('../../hello-world.hbs').to('./templates/components/hello-world.hbs');
          pairModule.resolves('../../../../components/hello-world.js').to('./components/hello-world.js');
        });

        test('hbs-only component', async function () {
          givenFiles({
            'templates/components/hello-world.hbs': '',
            'app.js': `import "#embroider_compat/components/hello-world"`,
          });

          await configure();

          let pairModule = expectAudit
            .module('./app.js')
            .resolves('#embroider_compat/components/hello-world')
            .toModule();

          pairModule.codeEquals(`
            import { setComponentTemplate } from "@ember/component";
            import template from "../hello-world.hbs";
            import templateOnlyComponent from "@ember/component/template-only";
            export default setComponentTemplate(template, templateOnlyComponent(undefined, "hello-world"));
          `);

          pairModule.resolves('../hello-world.hbs').to('./templates/components/hello-world.hbs');
        });

        test('podded js-only component with blank podModulePrefix', async function () {
          givenFiles({
            'components/hello-world/component.js': '',
            'app.js': `import "#embroider_compat/components/hello-world"`,
          });

          await configure();

          expectAudit
            .module('./app.js')
            .resolves('#embroider_compat/components/hello-world')
            .to('./components/hello-world/component.js');
        });

        test('podded js-only component with non-blank podModulePrefix', async function () {
          givenFiles({
            'pods/components/hello-world/component.js': '',
            'app.js': `import "#embroider_compat/components/hello-world"`,
          });

          await configure({ podModulePrefix: 'my-app/pods' });

          expectAudit
            .module('./app.js')
            .resolves('#embroider_compat/components/hello-world')
            .to('./pods/components/hello-world/component.js');
        });

        test('podded hbs-only component with blank podModulePrefix', async function () {
          givenFiles({
            'components/hello-world/template.hbs': '',
            'app.js': `import "#embroider_compat/components/hello-world"`,
          });

          await configure();

          let pairModule = expectAudit
            .module('./app.js')
            .resolves('#embroider_compat/components/hello-world')
            .toModule();

          pairModule.codeEquals(`
            import { setComponentTemplate } from "@ember/component";
            import template from "../template.hbs";
            import templateOnlyComponent from "@ember/component/template-only";
            export default setComponentTemplate(template, templateOnlyComponent(undefined, "template"));
          `);

          pairModule.resolves('../template.hbs').to('./components/hello-world/template.hbs');
        });

        test('podded hbs-only component with non-blank podModulePrefix', async function () {
          givenFiles({
            'pods/components/hello-world/template.hbs': '',
            'app.js': `import "#embroider_compat/components/hello-world"`,
          });

          await configure({ podModulePrefix: 'my-app/pods' });

          let pairModule = expectAudit
            .module('./app.js')
            .resolves('#embroider_compat/components/hello-world')
            .toModule();

          pairModule.codeEquals(`
            import { setComponentTemplate } from "@ember/component";
            import template from "../template.hbs";
            import templateOnlyComponent from "@ember/component/template-only";
            export default setComponentTemplate(template, templateOnlyComponent(undefined, "template"));
          `);

          pairModule.resolves('../template.hbs').to('./pods/components/hello-world/template.hbs');
        });

        test('podded js-and-hbs component with blank podModulePrefix', async function () {
          givenFiles({
            'components/hello-world/component.js': '',
            'components/hello-world/template.hbs': '',
            'app.js': `import "#embroider_compat/components/hello-world"`,
          });

          await configure();

          let pairModule = expectAudit
            .module('./app.js')
            .resolves('#embroider_compat/components/hello-world')
            .toModule();

          pairModule.codeEquals(`
            import { setComponentTemplate } from "@ember/component";
            import template from "../../template.hbs";
            import component from "../../component.js";
            export default setComponentTemplate(template, component);
          `);

          pairModule.resolves('../../template.hbs').to('./components/hello-world/template.hbs');
          pairModule.resolves('../../component.js').to('./components/hello-world/component.js');
        });

        test('podded js-and-hbs component with non-blank podModulePrefix', async function () {
          givenFiles({
            'pods/components/hello-world/component.js': '',
            'pods/components/hello-world/template.hbs': '',
            'app.js': `import "#embroider_compat/components/hello-world"`,
          });

          await configure({ podModulePrefix: 'my-app/pods' });

          let pairModule = expectAudit
            .module('./app.js')
            .resolves('#embroider_compat/components/hello-world')
            .toModule();

          pairModule.codeEquals(`
            import { setComponentTemplate } from "@ember/component";
            import template from "../../template.hbs";
            import component from "../../component.js";
            export default setComponentTemplate(template, component);
          `);

          pairModule.resolves('../../template.hbs').to('./pods/components/hello-world/template.hbs');
          pairModule.resolves('../../component.js').to('./pods/components/hello-world/component.js');
        });

        test('helper', async function () {
          givenFiles({
            'helpers/hello-world.js': '',
            'app.js': `import "#embroider_compat/helpers/hello-world"`,
          });

          await configure();

          expectAudit
            .module('./app.js')
            .resolves('#embroider_compat/helpers/hello-world')
            .to('./helpers/hello-world.js');
        });

        test('modifier', async function () {
          givenFiles({
            'modifiers/hello-world.js': '',
            'app.js': `import "#embroider_compat/modifiers/hello-world"`,
          });

          await configure();

          expectAudit
            .module('./app.js')
            .resolves('#embroider_compat/modifiers/hello-world')
            .to('./modifiers/hello-world.js');
        });

        test('nested ambiguous component', async function () {
          givenFiles({
            'components/something/hello-world.js': '',
            'app.js': `import "#embroider_compat/ambiguous/something/hello-world"`,
          });

          await configure();

          expectAudit
            .module('./app.js')
            .resolves('#embroider_compat/ambiguous/something/hello-world')
            .to('./components/something/hello-world.js');
        });

        test('nested ambiguous helper', async function () {
          givenFiles({
            'helpers/something/hello-world.js': '',
            'app.js': `import "#embroider_compat/ambiguous/something/hello-world"`,
          });

          await configure();

          expectAudit
            .module('./app.js')
            .resolves('#embroider_compat/ambiguous/something/hello-world')
            .to('./helpers/something/hello-world.js');
        });
      });
    });
  });
