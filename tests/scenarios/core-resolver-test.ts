import type { AddonMeta, RewrittenPackageIndex } from '@embroider/shared-internals';
import { outputFileSync, readJsonSync, writeJSONSync } from 'fs-extra';
import { resolve } from 'path';
import QUnit from 'qunit';
import type { PreparedApp } from 'scenario-tester';
import { Project, Scenarios } from 'scenario-tester';
import type { CompatResolverOptions } from '@embroider/compat/src/resolver-transform';
import type { ExpectAuditResults } from '@embroider/test-support/audit-assertions';
import { installAuditAssertions } from '@embroider/test-support/audit-assertions';
import { baseAddon, baseV2Addon } from './scenarios';

const { module: Qmodule, test } = QUnit;

Scenarios.fromProject(() => new Project())
  .map('core-resolver-test', app => {
    app.pkg = {
      name: 'my-app',
      exports: {
        './*': './*',
        './tests/*': './tests/*',
      },
    };
    app.mergeFiles({
      'index.html': '<script src="./app.js" type="module"></script>',
    });
    app.addDependency('the-apps-dep', {
      files: {
        'index.js': '',
      },
    });
    app.linkDevDependency('babel-plugin-ember-template-compilation', {
      baseDir: __dirname,
    });
    app.linkDevDependency('@embroider/compat', { baseDir: __dirname });
    app.linkDevDependency('@embroider/core', { baseDir: __dirname });

    let v1Addon = baseAddon();
    v1Addon.name = 'a-v1-addon';
    app.addDependency(v1Addon);

    // this is just an empty fixture package, it's the presence of a dependency
    // named ember-auto-import that tells us that the app was allowed to import
    // deps from npm.
    app.addDependency('ember-auto-import', { version: '2.0.0' });

    // We're not using a real copy of ember-source here because
    //  - this unit test is not running a whole v1-to-v2 addon prebuild. So we
    //    need a real v2 ember-source, which starts at ember-source 6.1.
    //  - but we also want to test some features that only worked on
    //    ember-source < 6, like non-colocated templates.
    // The solution is to stub a tiny v2 addon with just the parts of
    // ember-source's API that are relevant to the unit tests.
    let emberStub = baseV2Addon();
    emberStub.name = 'ember-source';
    emberStub.mergeFiles({
      '@ember': {
        component: {
          'index.js': 'export default class {}; export function setComponentTemplate() {}',
          'template-only.js': `export default function() {}`,
        },
        debug: {
          'index.js': 'export function deprecate() {}',
        },
        'template-compilation': {
          'index.js': `export function precompileTemplate() {}`,
        },
      },
      rsvp: {
        'index.js': `export {}`,
      },
    });
    app.addDevDependency(emberStub);
  })
  .forEachScenario(scenario => {
    Qmodule(scenario.name, function (hooks) {
      let expectAudit: ExpectAuditResults;
      let givenFiles: (files: Record<string, string>) => void;

      interface ConfigureOpts {
        podModulePrefix?: string;
        renamePackages?: Record<string, string>;
        addonMeta?: Partial<AddonMeta>;
        fastbootFiles?: { [appName: string]: { localFilename: string; shadowedFilename: string | undefined } };
      }

      let configure: (opts?: ConfigureOpts) => Promise<void>;
      let app: PreparedApp;

      function addonPackageJSON(name = 'my-addon', addonMeta?: Partial<AddonMeta>) {
        return JSON.stringify(
          (() => {
            let meta: AddonMeta = { version: 2, 'auto-upgraded': true, ...(addonMeta ?? {}) };
            return {
              name,
              keywords: ['ember-addon'],
              'ember-addon': meta,
              dependencies: {
                'ember-auto-import': '^2.0.0',
              },
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
            renameModules: {
              '@ember/component/index.js': 'ember-source/@ember/component/index.js',
              '@ember/component/template-only.js': 'ember-source/@ember/component/template-only.js',
              '@ember/debug/index.js': 'ember-source/@ember/debug/index.js',
              '@ember/template-compilation/index.js': 'ember-source/@ember/template-compilation/index.js',
              'rsvp/index.js': 'ember-source/rsvp/index.js',
            },
            renamePackages: opts?.renamePackages ?? {},
            resolvableExtensions: ['.js', '.hbs'],
            appRoot: app.dir,
            engines: [
              {
                packageName: 'my-app',
                isLazy: false,
                root: app.dir,
                fastbootFiles: opts?.fastbootFiles ?? {},
                activeAddons: [
                  {
                    name: 'ember-source',
                    root: resolve(app.dir, 'node_modules', 'ember-source'),
                    canResolveFromFile: resolve(app.dir, 'package.json'),
                  },
                  {
                    name: 'my-addon',
                    root: resolve(app.dir, 'node_modules', 'my-addon'),
                    canResolveFromFile: resolve(app.dir, 'package.json'),
                  },
                  {
                    name: 'a-v1-addon',
                    root: resolve(app.dir, 'node_modules', 'a-v1-addon'),
                    canResolveFromFile: resolve(app.dir, 'package.json'),
                  },
                ],
              },
            ],
            modulePrefix: 'my-app',
            podModulePrefix: opts?.podModulePrefix,
            options: {
              staticInvokables: false,
              allowUnsafeDynamicComponents: false,
            },
            activePackageRules: [
              {
                package: 'my-app',
                roots: [app.dir],
              },
            ],
            staticAppPaths: [],
            emberVersion: '4.0.0',
          };

          givenFiles({
            'babel.config.cjs': `
              const {
                babelCompatSupport,
                templateCompatSupport,
              } = require("@embroider/compat/babel");

              const babel = require('@babel/core');
              const babelCompatPlugins = babelCompatSupport().map(plugin => {
                if (plugin[0].endsWith('/@embroider/macros/src/babel/macros-babel-plugin.js')) {
                  // ESM plugin must be resolved manually when using Babel directly from CJS config
                  return babel.createConfigItem([ require(plugin[0]).default, plugin[1] ]);
                } else {
                  return plugin;
                }
              });

              module.exports = {
                plugins: [
                  ['babel-plugin-ember-template-compilation', {
                    targetFormat: 'hbs',
                    transforms: [
                      ...templateCompatSupport(),
                    ],
                    enableLegacyModules: [
                      'ember-cli-htmlbars'
                    ]
                  }],
                  ...babelCompatPlugins
                ]
              }
            `,

            'node_modules/.embroider/resolver.json': JSON.stringify(resolverOptions),
            'node_modules/my-addon/package.json': addonPackageJSON('my-addon', opts?.addonMeta),
          });

          expectAudit = await withDevelopingApp(() =>
            assert.audit({
              app: app.dir,
              'reuse-build': true,
              entrypoints: ['index.html'],
              rootURL: '/',
            })
          );
        };
      });

      hooks.afterEach(() => {
        expectAudit.hasNoProblems();
      });

      Qmodule('@embroider/virtual', function () {
        test('js-only component', async function () {
          givenFiles({
            'components/hello-world.js': '',
            'app.js': `import "@embroider/virtual/components/hello-world"`,
          });

          await configure();

          expectAudit
            .module('./app.js')
            .resolves('@embroider/virtual/components/hello-world')
            .to('./components/hello-world.js');
        });

        test('js-and-hbs component', async function () {
          givenFiles({
            'components/hello-world.js': 'export default function() {}',
            'templates/components/hello-world.hbs': '',
            'app.js': `import "@embroider/virtual/components/hello-world"`,
          });

          await configure();

          let pairModule = expectAudit
            .module('./app.js')
            .resolves('@embroider/virtual/components/hello-world')
            .toModule();

          let templateFile = normalizePath(`${app.dir}/templates/components/hello-world.hbs`);
          let componentFile = normalizePath(`${app.dir}/components/hello-world.js`);

          pairModule.codeEquals(`
            import { setComponentTemplate } from "@ember/component";
            import template from "${esc(templateFile)}";
            import { deprecate } from "@ember/debug";
            true && !false && deprecate(
              "Components with separately resolved templates are deprecated. Migrate to either co-located js/ts + hbs files or to gjs/gts. Tried to lookup 'hello-world'.",
              false,
              {
                id: "component-template-resolving",
                url: "https://deprecations.emberjs.com/id/component-template-resolving",
                until: "6.0.0",
                for: "ember-source",
                since: {
                  available: "5.10.0",
                  enabled: "5.10.0",
                },
              }
            );
            import component from "${esc(componentFile)}";
            export default setComponentTemplate(template, component);
          `);

          pairModule.resolves(templateFile).to('./templates/components/hello-world.hbs');
          pairModule.resolves(componentFile).to('./components/hello-world.js');
        });

        test('hbs-only component', async function () {
          givenFiles({
            'templates/components/hello-world.hbs': '',
            'app.js': `import "@embroider/virtual/components/hello-world"`,
          });

          await configure();

          let pairModule = expectAudit
            .module('./app.js')
            .resolves('@embroider/virtual/components/hello-world')
            .toModule();

          let templateFile = normalizePath(`${app.dir}/templates/components/hello-world.hbs`);
          pairModule.codeEquals(`
            import { setComponentTemplate } from "@ember/component";
            import template from "${esc(templateFile)}";
            import { deprecate } from "@ember/debug";
            true && !false && deprecate(
              "Components with separately resolved templates are deprecated. Migrate to either co-located js/ts + hbs files or to gjs/gts. Tried to lookup 'hello-world'.",
              false,
              {
                id: "component-template-resolving",
                url: "https://deprecations.emberjs.com/id/component-template-resolving",
                until: "6.0.0",
                for: "ember-source",
                since: {
                  available: "5.10.0",
                  enabled: "5.10.0",
                },
              }
            );
            import templateOnlyComponent from "@ember/component/template-only";
            export default setComponentTemplate(template, templateOnlyComponent(undefined, "hello-world"));
          `);

          pairModule.resolves(templateFile).to('./templates/components/hello-world.hbs');
        });

        test('explicitly namedspaced component', async function () {
          givenFiles({
            'node_modules/my-addon/components/thing.js': '',
            'app.js': `import "@embroider/virtual/components/my-addon@thing"`,
          });

          await configure();

          expectAudit
            .module('./app.js')
            .resolves('@embroider/virtual/components/my-addon@thing')
            .to('./node_modules/my-addon/components/thing.js');
        });

        test('explicitly namedspaced component in renamed package', async function () {
          givenFiles({
            'node_modules/my-addon/components/thing.js': '',
            'app.js': `import "@embroider/virtual/components/has-been-renamed@thing"`,
          });

          await configure({
            renamePackages: {
              'has-been-renamed': 'my-addon',
            },
          });

          expectAudit
            .module('./app.js')
            .resolves('@embroider/virtual/components/has-been-renamed@thing')
            .to('./node_modules/my-addon/components/thing.js');
        });

        test('explicitly namedspaced component references its own package', async function () {
          givenFiles({
            'app.js': `import "my-addon/components/thing"`,
            'node_modules/my-addon/components/thing.js': `import "@embroider/virtual/components/my-addon@inner"`,
            'node_modules/my-addon/components/inner.js': '',
          });

          await configure();

          expectAudit
            .module('./node_modules/my-addon/components/thing.js')
            .resolves('@embroider/virtual/components/my-addon@inner')
            .to('./node_modules/my-addon/components/inner.js');
        });

        test('podded js-only component with blank podModulePrefix', async function () {
          givenFiles({
            'components/hello-world/component.js': '',
            'app.js': `import "@embroider/virtual/components/hello-world"`,
          });

          await configure();

          expectAudit
            .module('./app.js')
            .resolves('@embroider/virtual/components/hello-world')
            .to('./components/hello-world/component.js');
        });

        test('podded js-only component with non-blank podModulePrefix', async function () {
          givenFiles({
            'pods/components/hello-world/component.js': '',
            'app.js': `import "@embroider/virtual/components/hello-world"`,
          });

          await configure({ podModulePrefix: 'my-app/pods' });

          expectAudit
            .module('./app.js')
            .resolves('@embroider/virtual/components/hello-world')
            .to('./pods/components/hello-world/component.js');
        });

        test('podded hbs-only component with blank podModulePrefix', async function () {
          givenFiles({
            'components/hello-world/template.hbs': '',
            'app.js': `import "@embroider/virtual/components/hello-world"`,
          });

          await configure();

          let pairModule = expectAudit
            .module('./app.js')
            .resolves('@embroider/virtual/components/hello-world')
            .toModule();

          let templateFile = normalizePath(`${app.dir}/components/hello-world/template.hbs`);

          pairModule.codeEquals(`
            import { setComponentTemplate } from "@ember/component";
            import template from "${esc(templateFile)}";
            import { deprecate } from "@ember/debug";
            true && !false && deprecate(
              "Components with separately resolved templates are deprecated. Migrate to either co-located js/ts + hbs files or to gjs/gts. Tried to lookup 'template'.",
              false,
              {
                id: "component-template-resolving",
                url: "https://deprecations.emberjs.com/id/component-template-resolving",
                until: "6.0.0",
                for: "ember-source",
                since: {
                  available: "5.10.0",
                  enabled: "5.10.0",
                },
              }
            );
            import templateOnlyComponent from "@ember/component/template-only";
            export default setComponentTemplate(template, templateOnlyComponent(undefined, "template"));
          `);

          pairModule.resolves(templateFile).to('./components/hello-world/template.hbs');
        });

        test('podded hbs-only component with non-blank podModulePrefix', async function () {
          givenFiles({
            'pods/components/hello-world/template.hbs': '',
            'app.js': `import "@embroider/virtual/components/hello-world"`,
          });

          await configure({ podModulePrefix: 'my-app/pods' });

          let pairModule = expectAudit
            .module('./app.js')
            .resolves('@embroider/virtual/components/hello-world')
            .toModule();

          let templateFile = normalizePath(`${app.dir}/pods/components/hello-world/template.hbs`);

          pairModule.codeEquals(`
            import { setComponentTemplate } from "@ember/component";
            import template from "${esc(templateFile)}";
            import { deprecate } from "@ember/debug";
            true && !false && deprecate(
              "Components with separately resolved templates are deprecated. Migrate to either co-located js/ts + hbs files or to gjs/gts. Tried to lookup 'template'.",
              false,
              {
                id: "component-template-resolving",
                url: "https://deprecations.emberjs.com/id/component-template-resolving",
                until: "6.0.0",
                for: "ember-source",
                since: {
                  available: "5.10.0",
                  enabled: "5.10.0",
                },
              }
            );
            import templateOnlyComponent from "@ember/component/template-only";
            export default setComponentTemplate(template, templateOnlyComponent(undefined, "template"));
          `);

          pairModule.resolves(templateFile).to('./pods/components/hello-world/template.hbs');
        });

        test('podded js-and-hbs component with blank podModulePrefix', async function () {
          givenFiles({
            'components/hello-world/component.js': 'export default function() {}',
            'components/hello-world/template.hbs': '',
            'app.js': `import "@embroider/virtual/components/hello-world"`,
          });

          await configure();

          let pairModule = expectAudit
            .module('./app.js')
            .resolves('@embroider/virtual/components/hello-world')
            .toModule();

          let templateFile = normalizePath(`${app.dir}/components/hello-world/template.hbs`);
          let componentFile = normalizePath(`${app.dir}/components/hello-world/component.js`);

          pairModule.codeEquals(`
            import { setComponentTemplate } from "@ember/component";
            import template from "${esc(templateFile)}";
            import { deprecate } from "@ember/debug";
            true && !false && deprecate(
              "Components with separately resolved templates are deprecated. Migrate to either co-located js/ts + hbs files or to gjs/gts. Tried to lookup 'template'.",
              false,
              {
                id: "component-template-resolving",
                url: "https://deprecations.emberjs.com/id/component-template-resolving",
                until: "6.0.0",
                for: "ember-source",
                since: {
                  available: "5.10.0",
                  enabled: "5.10.0",
                },
              }
            );
            import component from "${esc(componentFile)}";
            export default setComponentTemplate(template, component);
          `);

          pairModule.resolves(templateFile).to('./components/hello-world/template.hbs');
          pairModule.resolves(componentFile).to('./components/hello-world/component.js');
        });

        test('podded js-and-hbs component with non-blank podModulePrefix', async function () {
          givenFiles({
            'pods/components/hello-world/component.js': 'export default function() {}',
            'pods/components/hello-world/template.hbs': '',
            'app.js': `import "@embroider/virtual/components/hello-world"`,
          });

          await configure({ podModulePrefix: 'my-app/pods' });

          let pairModule = expectAudit
            .module('./app.js')
            .resolves('@embroider/virtual/components/hello-world')
            .toModule();

          let templateFile = normalizePath(`${app.dir}/pods/components/hello-world/template.hbs`);
          let componentFile = normalizePath(`${app.dir}/pods/components/hello-world/component.js`);

          pairModule.codeEquals(`
            import { setComponentTemplate } from "@ember/component";
            import template from "${esc(templateFile)}";
            import { deprecate } from "@ember/debug";
            true && !false && deprecate(
              "Components with separately resolved templates are deprecated. Migrate to either co-located js/ts + hbs files or to gjs/gts. Tried to lookup 'template'.",
              false,
              {
                id: "component-template-resolving",
                url: "https://deprecations.emberjs.com/id/component-template-resolving",
                until: "6.0.0",
                for: "ember-source",
                since: {
                  available: "5.10.0",
                  enabled: "5.10.0",
                },
              }
            );
            import component from "${esc(componentFile)}";
            export default setComponentTemplate(template, component);
          `);
          pairModule.resolves(templateFile).to('./pods/components/hello-world/template.hbs');
          pairModule.resolves(componentFile).to('./pods/components/hello-world/component.js');
        });

        test('plain helper', async function () {
          givenFiles({
            'helpers/hello-world.js': '',
            'app.js': `import "@embroider/virtual/helpers/hello-world"`,
          });

          await configure();

          expectAudit
            .module('./app.js')
            .resolves('@embroider/virtual/helpers/hello-world')
            .to('./helpers/hello-world.js');
        });

        test('namespaced helper', async function () {
          givenFiles({
            'node_modules/my-addon/helpers/hello-world.js': '',
            'app.js': `import "@embroider/virtual/helpers/my-addon@hello-world"`,
          });

          await configure();

          expectAudit
            .module('./app.js')
            .resolves('@embroider/virtual/helpers/my-addon@hello-world')
            .to('./node_modules/my-addon/helpers/hello-world.js');
        });

        test('modifier', async function () {
          givenFiles({
            'modifiers/hello-world.js': '',
            'app.js': `import "@embroider/virtual/modifiers/hello-world"`,
          });

          await configure();

          expectAudit
            .module('./app.js')
            .resolves('@embroider/virtual/modifiers/hello-world')
            .to('./modifiers/hello-world.js');
        });

        test('nested ambiguous component', async function () {
          givenFiles({
            'components/something/hello-world.js': '',
            'app.js': `import "@embroider/virtual/ambiguous/something/hello-world"`,
          });

          await configure();

          expectAudit
            .module('./app.js')
            .resolves('@embroider/virtual/ambiguous/something/hello-world')
            .to('./components/something/hello-world.js');
        });

        test('nested ambiguous helper', async function () {
          givenFiles({
            'helpers/something/hello-world.js': '',
            'app.js': `import "@embroider/virtual/ambiguous/something/hello-world"`,
          });

          await configure();

          expectAudit
            .module('./app.js')
            .resolves('@embroider/virtual/ambiguous/something/hello-world')
            .to('./helpers/something/hello-world.js');
        });
      });

      Qmodule('engine-relative resolving', function () {
        test('module in app takes precedence over module in addon', async function () {
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

        test('app-js module in addon can still do relative imports that escape its package', async function () {
          givenFiles({
            'node_modules/extra.js': '',
            'node_modules/my-addon/_app_/hello-world.js': 'import "../../extra.js"',
            'app.js': `import "my-app/hello-world"`,
          });

          await configure({
            addonMeta: {
              'app-js': { './hello-world.js': './_app_/hello-world.js' },
            },
          });

          expectAudit
            .module('./node_modules/my-addon/_app_/hello-world.js')
            .resolves('../../extra.js')
            .to('./node_modules/extra.js');
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

        test(`relative import in addon's app tree correctly prioritizes app`, async function () {
          givenFiles({
            'node_modules/my-addon/_app_/hello-world.js': `import "./secondary"`,
            'node_modules/my-addon/_app_/secondary.js': ``,
            'app.js': `import "my-app/hello-world"`,
            'secondary.js': '',
          });

          await configure({
            addonMeta: {
              'app-js': { './hello-world.js': './_app_/hello-world.js', './secondary.js': './_app_/secondary.js' },
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

        test(`known ember-source-provided virtual packages are externalized even when accidentally resolvable`, async function () {
          givenFiles({
            'node_modules/rsvp/index.js': `export {}`,
            'app.js': `import "rsvp"`,
          });
          await configure({});
          expectAudit.module('./app.js').resolves('rsvp').to('./node_modules/ember-source/rsvp/index.js');
        });

        test(`known ember-source-provided virtual packages are not externalized when explicitly included in deps`, async function () {
          let pkg = readJsonSync(resolve(app.dir, 'package.json'));
          pkg.dependencies['rsvp'] = '*';
          writeJSONSync(resolve(app.dir, 'package.json'), pkg);
          givenFiles({
            'node_modules/rsvp/index.js': '',
            'app.js': `import "rsvp"`,
          });
          await configure({});
          expectAudit.module('./app.js').resolves('rsvp').to('./node_modules/rsvp/index.js');
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

        test(`resolves app fastboot-js`, async function () {
          givenFiles({
            './fastboot/hello-world.js': ``,
            'app.js': `import "my-app/hello-world"`,
          });

          await configure({
            fastbootFiles: {
              './hello-world.js': { localFilename: './fastboot/hello-world.js', shadowedFilename: undefined },
            },
          });

          expectAudit.module('./app.js').resolves('my-app/hello-world').to('./fastboot/hello-world.js');
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

        test(`app and fastboot file exists`, async function () {
          givenFiles({
            'fastboot/hello-world.js': `
              export function hello() { return 'fastboot'; }
              export class Bonjour {}
              export default function() {}
              const value = 1;
              export { value };
              export const x = 2;
            `,
            'app/hello-world.js': `
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
            fastbootFiles: {
              './hello-world.js': {
                localFilename: './fastboot/hello-world.js',
                shadowedFilename: './app/hello-world.js',
              },
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

          switcherModule.resolves('./fastboot').to('./fastboot/hello-world.js');
          switcherModule.resolves('./browser').to('./app/hello-world.js');
        });
      });

      Qmodule('legacy-addons', function () {
        test('app can resolve file in rewritten addon', async function () {
          let index: RewrittenPackageIndex = {
            packages: {
              [resolve(app.dir, 'node_modules/my-addon')]: 'my-addon.1234/node_modules/my-addon',
            },
            extraResolutions: {},
          };
          givenFiles({
            'node_modules/.embroider/rewritten-packages/index.json': JSON.stringify(index),
            'node_modules/.embroider/rewritten-packages/my-addon.1234/node_modules/my-addon/hello-world.js': ``,
            'node_modules/.embroider/rewritten-packages/my-addon.1234/node_modules/my-addon/package.json':
              addonPackageJSON(),
            'app.js': `import "my-addon/hello-world"`,
          });

          await configure({});

          expectAudit
            .module('./app.js')
            .resolves('my-addon/hello-world')
            .to('./node_modules/.embroider/rewritten-packages/my-addon.1234/node_modules/my-addon/hello-world.js');
        });

        test('moved addon resolves dependencies from its original location', async function () {
          let index: RewrittenPackageIndex = {
            packages: {
              [resolve(app.dir, 'node_modules/my-addon')]: 'my-addon.1234/node_modules/my-addon',
            },
            extraResolutions: {},
          };
          givenFiles({
            'node_modules/my-addon/node_modules/inner-dep/package.json': '{ "name": "inner-dep" }',
            'node_modules/my-addon/node_modules/inner-dep/index.js': '',
            'node_modules/.embroider/rewritten-packages/index.json': JSON.stringify(index),
            'node_modules/.embroider/rewritten-packages/my-addon.1234/node_modules/my-addon/hello-world.js': `import "inner-dep"`,
            'node_modules/.embroider/rewritten-packages/my-addon.1234/node_modules/my-addon/package.json':
              addonPackageJSON(),
            'app.js': `import "my-addon/hello-world"`,
          });

          await configure({});

          expectAudit
            .module('./node_modules/.embroider/rewritten-packages/my-addon.1234/node_modules/my-addon/hello-world.js')
            .resolves('inner-dep')
            .to('./node_modules/my-addon/node_modules/inner-dep/index.js');
        });

        test('implicit modules in moved dependencies', async function () {
          let index: RewrittenPackageIndex = {
            packages: {
              [resolve(app.dir, 'node_modules/a-v1-addon')]: 'a-v1-addon.1234/node_modules/a-v1-addon',
            },
            extraResolutions: {},
          };
          givenFiles({
            'node_modules/.embroider/rewritten-packages/index.json': JSON.stringify(index),
            'node_modules/.embroider/rewritten-packages/a-v1-addon.1234/node_modules/a-v1-addon/_app_/components/i-am-implicit.js': ``,
            'node_modules/.embroider/rewritten-packages/a-v1-addon.1234/node_modules/a-v1-addon/package.json':
              addonPackageJSON('a-v1-addon', {
                'implicit-modules': ['./_app_/components/i-am-implicit.js'],
              }),
            'app.js': `import "./-embroider-implicit-modules.js"`,
          });

          await configure({});

          expectAudit
            .module('./app.js')
            .resolves('./-embroider-implicit-modules.js')
            .toModule()
            .resolves('a-v1-addon/_app_/components/i-am-implicit.js')
            .to(
              './node_modules/.embroider/rewritten-packages/a-v1-addon.1234/node_modules/a-v1-addon/_app_/components/i-am-implicit.js'
            );
        });
      });
    });
  });

function normalizePath(s: string): string {
  if (process.platform === 'win32') {
    return s.replace(/\//g, '\\');
  } else {
    return s;
  }
}

function esc(s: string): string {
  return s.replace(/\\/g, '\\\\');
}

async function withDevelopingApp<T>(callback: () => T): Promise<T> {
  let originalValue = process.env.NODE_ENV;
  process.env.NODE_ENV = 'development'; // read by buildMacros() in packages/macros/src/babel.ts
  try {
    return await callback();
  } finally {
    process.env.NODE_ENV = originalValue;
  }
}
