import { AddonMeta, AppMeta } from '@embroider/shared-internals';
import { outputFileSync } from 'fs-extra';
import { resolve } from 'path';
import QUnit from 'qunit';
import { PreparedApp, Project, Scenarios } from 'scenario-tester';
import { CompatResolverOptions } from '@embroider/compat/src/resolver-transform';
import { ExpectAuditResults } from '@embroider/test-support/audit-assertions';
import { installAuditAssertions } from '@embroider/test-support/audit-assertions';

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
    app.addDependency('the-apps-dep', {
      files: {
        'index.js': '',
      },
    });

    // this is just an empty fixture package, it's the presence of a dependency
    // named ember-auto-import that tells us that the app was allowed to import
    // deps from npm.
    app.addDependency('ember-auto-import', { version: '2.0.0' });
  })
  .forEachScenario(scenario => {
    Qmodule(scenario.name, function (hooks) {
      let expectAudit: ExpectAuditResults;
      let givenFiles: (files: Record<string, string>) => void;

      interface ConfigureOpts {
        podModulePrefix?: string;
        renamePackages?: Record<string, string>;
        addonMeta?: Partial<AddonMeta>;
      }

      let configure: (opts?: ConfigureOpts) => Promise<void>;
      let app: PreparedApp;

      function addonPackageJSON(addonMeta?: Partial<AddonMeta>) {
        return JSON.stringify(
          (() => {
            let meta: AddonMeta = { type: 'addon', version: 2, 'auto-upgraded': true, ...(addonMeta ?? {}) };
            return {
              name: 'my-addon',
              keywords: ['ember-addon'],
              'ember-addon': meta,
            };
          })(),
          null,
          2
        );
      }

      hooks.beforeEach(async assert => {
        installAuditAssertions(assert);
        app = await scenario.prepare();

        givenFiles = function (files: Record<string, string>) {
          for (let [filename, contents] of Object.entries(files)) {
            outputFileSync(resolve(app.dir, filename), contents, 'utf8');
          }
        };
        configure = async function (opts?: ConfigureOpts) {
          let resolverOptions: CompatResolverOptions = {
            activeAddons: {},
            renameModules: {},
            renamePackages: opts?.renamePackages ?? {},
            resolvableExtensions: ['.js', '.hbs'],
            appRoot: app.dir,
            engines: [
              {
                packageName: 'my-app',
                root: app.dir,
                activeAddons: [
                  {
                    name: 'my-addon',
                    root: resolve(app.dir, 'node_modules', 'my-addon'),
                  },
                ],
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
            'node_modules/.embroider/resolver.json': JSON.stringify(resolverOptions),
            'node_modules/my-addon/package.json': addonPackageJSON(opts?.addonMeta),
          });

          expectAudit = await assert.audit({ outputDir: app.dir });
        };
      });

      hooks.afterEach(() => {
        expectAudit.hasNoProblems();
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
            'components/hello-world.js': 'export default function() {}',
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

        test('explicitly namedspaced component', async function () {
          givenFiles({
            'node_modules/my-addon/components/thing.js': '',
            'app.js': `import "#embroider_compat/components/my-addon@thing"`,
          });

          await configure();

          expectAudit
            .module('./app.js')
            .resolves('#embroider_compat/components/my-addon@thing')
            .to('./node_modules/my-addon/components/thing.js');
        });

        test('explicitly namedspaced component in renamed package', async function () {
          givenFiles({
            'node_modules/my-addon/components/thing.js': '',
            'app.js': `import "#embroider_compat/components/has-been-renamed@thing"`,
          });

          await configure({
            renamePackages: {
              'has-been-renamed': 'my-addon',
            },
          });

          expectAudit
            .module('./app.js')
            .resolves('#embroider_compat/components/has-been-renamed@thing')
            .to('./node_modules/my-addon/components/thing.js');
        });

        test('explicitly namedspaced component references its own package', async function () {
          givenFiles({
            'app.js': `import "my-addon/components/thing"`,
            'node_modules/my-addon/components/thing.js': `import "#embroider_compat/components/my-addon@inner"`,
            'node_modules/my-addon/components/inner.js': '',
          });

          await configure();

          expectAudit
            .module('./node_modules/my-addon/components/thing.js')
            .resolves('#embroider_compat/components/my-addon@inner')
            .to('./node_modules/my-addon/components/inner.js');
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
            'components/hello-world/component.js': 'export default function() {}',
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
            'pods/components/hello-world/component.js': 'export default function() {}',
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

        test('plain helper', async function () {
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

        test('namespaced helper', async function () {
          givenFiles({
            'node_modules/my-addon/helpers/hello-world.js': '',
            'app.js': `import "#embroider_compat/helpers/my-addon@hello-world"`,
          });

          await configure();

          expectAudit
            .module('./app.js')
            .resolves('#embroider_compat/helpers/my-addon@hello-world')
            .to('./node_modules/my-addon/helpers/hello-world.js');
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

      Qmodule('engine-relative resolving', function () {
        test('module in app takes precedence', async function () {
          givenFiles({
            'node_modules/my-addon/_app_/hello-world.js': '',
            './hello-world.js': '',
            'app.js': `import "my-app/hello-world"`,
          });

          await configure({
            addonMeta: {
              'app-js': { './hello-world.js': './_app_/hello-world.js' },
            },
          });

          expectAudit.module('./app.js').resolves('my-app/hello-world').to('./hello-world.js');
        });

        test('module in addon is found', async function () {
          givenFiles({
            'node_modules/my-addon/_app_/hello-world.js': '',
            'app.js': `import "my-app/hello-world"`,
          });

          await configure({
            addonMeta: {
              'app-js': { './hello-world.js': './_app_/hello-world.js' },
            },
          });

          expectAudit
            .module('./app.js')
            .resolves('my-app/hello-world')
            .to('./node_modules/my-addon/_app_/hello-world.js');
        });

        test('hbs in addon is found', async function () {
          givenFiles({
            'node_modules/my-addon/_app_/templates/hello-world.hbs': '',
            'app.js': `import "my-app/templates/hello-world"`,
          });

          await configure({
            addonMeta: {
              'app-js': { './templates/hello-world.hbs': './_app_/templates/hello-world.hbs' },
            },
          });

          expectAudit
            .module('./app.js')
            .resolves('my-app/templates/hello-world')
            .to('./node_modules/my-addon/_app_/templates/hello-world.hbs');
        });

        test(`relative import in addon's app tree resolves to app`, async function () {
          givenFiles({
            'node_modules/my-addon/_app_/hello-world.js': `import "./secondary"`,
            'app.js': `import "my-app/hello-world"`,
            'secondary.js': '',
          });

          await configure({
            addonMeta: {
              'app-js': { './hello-world.js': './_app_/hello-world.js' },
            },
          });

          expectAudit
            .module('./node_modules/my-addon/_app_/hello-world.js')
            .resolves('./secondary')
            .to('./secondary.js');
        });

        test(`classic addon's app tree can resolve app's dependencies`, async function () {
          givenFiles({
            'node_modules/my-addon/_app_/hello-world.js': `import "the-apps-dep"`,
            'app.js': `import "my-app/hello-world"`,
          });

          await configure({
            addonMeta: {
              'app-js': { './hello-world.js': './_app_/hello-world.js' },
            },
          });

          expectAudit
            .module('./node_modules/my-addon/_app_/hello-world.js')
            .resolves('the-apps-dep')
            .to('./node_modules/the-apps-dep/index.js');
        });

        test(`absolute import in addon's app tree resolves to app`, async function () {
          givenFiles({
            'node_modules/my-addon/_app_/hello-world.js': `import "my-app/secondary"`,
            'app.js': `import "my-app/hello-world"`,
            'secondary.js': '',
          });

          await configure({
            addonMeta: {
              'app-js': { './hello-world.js': './_app_/hello-world.js' },
            },
          });

          expectAudit
            .module('./node_modules/my-addon/_app_/hello-world.js')
            .resolves('my-app/secondary')
            .to('./secondary.js');
        });

        test(`resolves addon fastboot-js`, async function () {
          givenFiles({
            'node_modules/my-addon/_fastboot_/hello-world.js': ``,
            'app.js': `import "my-app/hello-world"`,
          });

          await configure({
            addonMeta: {
              'fastboot-js': { './hello-world.js': './_fastboot_/hello-world.js' },
            },
          });

          expectAudit
            .module('./app.js')
            .resolves('my-app/hello-world')
            .to('./node_modules/my-addon/_fastboot_/hello-world.js');
        });

        test(`file exists in both app-js and fastboot-js`, async function () {
          givenFiles({
            'node_modules/my-addon/_fastboot_/hello-world.js': `
              export function hello() { return 'fastboot'; }
              export class Bonjour {}
              export default function() {}
              const value = 1;
              export { value };
              export const x = 2;
            `,
            'node_modules/my-addon/_app_/hello-world.js': `
              export function hello() { return 'browser'; }
              export class Bonjour {}
              export default function() {}
              const value = 1;
              export { value };
              export const x = 2;
          `,
            'app.js': `import "my-app/hello-world"`,
          });

          await configure({
            addonMeta: {
              'fastboot-js': { './hello-world.js': './_fastboot_/hello-world.js' },
              'app-js': { './hello-world.js': './_app_/hello-world.js' },
            },
          });

          let switcherModule = expectAudit.module('./app.js').resolves('my-app/hello-world').toModule();
          switcherModule.codeEquals(`
            import { macroCondition, getGlobalConfig, importSync } from '@embroider/macros';
            let mod;
            if (macroCondition(getGlobalConfig().fastboot?.isRunning)) {
              mod = importSync("./fastboot");
            } else {
              mod = importSync("./browser");
            }
            export default mod.default;
            export const hello = mod.hello;
            export const Bonjour = mod.Bonjour;
            export const value = mod.value;
            export const x = mod.x;
          `);

          switcherModule.resolves('./fastboot').to('./node_modules/my-addon/_fastboot_/hello-world.js');
          switcherModule.resolves('./browser').to('./node_modules/my-addon/_app_/hello-world.js');
        });
      });

      Qmodule('legacy-addons', function () {
        QUnit.skip('app can resolve file in rewritten addon', async function () {
          givenFiles({
            'node_modules/.embroider/rewritten-packages/index.json': JSON.stringify({
              packages: {
                [resolve(app.dir, 'node_modules/my-addon')]: 'my-addon.1234',
              },
            }),
            'node_modules/.embroider/rewritten-packages/my-addon.1234/hello-world.js': ``,
            'node_modules/.embroider/rewritten-packages/my-addon.1234/package.json': addonPackageJSON(),
            'app.js': `import "my-addon/hello-world"`,
          });

          await configure({});

          expectAudit
            .module('./app.js')
            .resolves('my-addon/hello-world')
            .to('./node_modules/.embroider/rewritten-packages/my-addon.1234/hello-world.js');
        });

        QUnit.skip('moved addon resolves dependencies from its original location', async function () {
          givenFiles({
            'node_modules/my-addon/node_modules/inner-dep/index.js': '',
            'node_modules/.embroider/rewritten-packages/index.json': JSON.stringify({
              packages: {
                [resolve(app.dir, 'node_modules/my-addon')]: 'my-addon.1234',
              },
            }),
            'node_modules/.embroider/rewritten-packages/my-addon.1234/hello-world.js': `import "inner-dep"`,
            'node_modules/.embroider/rewritten-packages/my-addon.1234/package.json': addonPackageJSON(),
            'app.js': `import "my-addon/hello-world"`,
          });

          await configure({});

          expectAudit
            .module('./node_modules/.embroider/rewritten-packages/my-addon.1234/hello-world.js')
            .resolves('inner-dep')
            .to('./node_modules/my-addon/node_modules/inner-dep/index.js');
        });
      });
    });
  });
