import type { Options } from '@embroider/compat';
import type { PreparedApp, Project } from 'scenario-tester';
import { appScenarios, baseAddon, dummyAppScenarios, renameApp } from './scenarios';
import { resolve, join } from 'path';
import { Transpiler } from '@embroider/test-support';
import type { ExpectFile } from '@embroider/test-support/file-assertions/qunit';
import { expectRewrittenFilesAt } from '@embroider/test-support/file-assertions/qunit';
import { throwOnWarnings } from '@embroider/core';
import merge from 'lodash/merge';
import fetch from 'node-fetch';
import QUnit from 'qunit';
import { setupAuditTest } from '@embroider/test-support/audit-assertions';
import CommandWatcher from './helpers/command-watcher';
import { readJsonSync, writeJsonSync } from 'fs-extra';

const { module: Qmodule, test } = QUnit;

let stage2Scenarios = appScenarios.map('compat-stage2-build', app => {
  renameApp(app, 'my-app');
});

function resolveEntryPoint(expectAudit: ReturnType<typeof setupAuditTest>) {
  return expectAudit
    .module('./index.html')
    .resolves(/\/index.html.*/) // in-html app-boot script
    .toModule()
    .resolves(/\/app\.js.*/)
    .toModule()
    .resolves(/.*\/-embroider-entrypoint.js/)
    .toModule();
}

stage2Scenarios
  .map('in-repo-addons-of-addons', app => {
    app.mergeFiles({
      app: {
        'lib.js': 'export {default} from "dep-a/check-resolution.js"',
      },
      tests: {
        unit: {
          'in-repo-addons-of-addons.js': `import { module, test } from 'qunit';

          import libJS from 'my-app/lib';
          import inRepo from 'my-app/service/in-repo';
          import secondaryService from 'my-app/services/secondary';
          import primaryService from 'my-app/services/primary';

          module('Unit | basics', function () {
            test('libJS resolution comes from the right place', async function (assert) {
              assert.strictEqual(libJS, 'in-repo-a|check-resolution-target.js');
            });

            test('inRepo resolution comes from the right place', async function (assert) {
              assert.strictEqual(inRepo, 'in-repo-c|service|in-repo.js');
            });

            test('secondaryService resolution comes from the right place', async function (assert) {
              assert.strictEqual(secondaryService, 'secondary-in-repo-addon|service|secondary.js');
            });

            test('primaryService resolution comes from the right place', async function (assert) {
              assert.strictEqual(primaryService, 'secondary-in-repo-addon|component|secondary.js');
            });
          })
          `,
        },
      },
    });

    let depA = addAddon(app, 'dep-a');
    let depB = addAddon(app, 'dep-b');
    let depC = addAddon(app, 'dep-c');

    addInRepoAddon(depC, 'in-repo-d', {
      app: { service: { 'in-repo.js': 'export default "in-repo-d|service|in-repo.js";' } },
    });
    addInRepoAddon(depA, 'in-repo-a', {
      app: { service: { 'in-repo.js': 'export default "in-repo-a|service|in-repo.js";' } },
      addon: {
        'check-resolution-target.js': 'export default "in-repo-a|check-resolution-target.js";',
      },
    });
    merge(depA.files, {
      addon: {
        'check-resolution.js': `
          export { default } from 'in-repo-a/check-resolution-target';
        `,
      },
    });
    addInRepoAddon(depB, 'in-repo-b', {
      app: { service: { 'in-repo.js': 'export default "in-repo-b|service|in-repo.js";' } },
    });
    addInRepoAddon(depB, 'in-repo-c', {
      app: { service: { 'in-repo.js': 'export default "in-repo-c|service|in-repo.js";' } },
    });

    // make an in-repo addon with a dependency on a secondary in-repo-addon
    addInRepoAddon(app, 'primary-in-repo-addon', {
      'package.json': JSON.stringify(
        {
          name: 'primary-in-repo-addon',
          keywords: ['ember-addon'],
          'ember-addon': {
            paths: ['../secondary-in-repo-addon'],
          },
        },
        null,
        2
      ),
      app: {
        services: {
          'primary.js': `export {default} from "secondary-in-repo-addon/components/secondary"`,
        },
      },
    });

    // critically, this in-repo addon gets removed from the app's actual
    // ember-addon.paths, so it's *only* consumed by primary-in-repo-addon.
    addInRepoAddon(app, 'secondary-in-repo-addon', {
      app: {
        services: {
          'secondary.js': 'export default "secondary-in-repo-addon|service|secondary.js";',
        },
      },
      addon: {
        components: {
          'secondary.js': 'export default "secondary-in-repo-addon|component|secondary.js";',
        },
      },
    });
    (app.pkg['ember-addon'] as any).paths = (app.pkg['ember-addon'] as any).paths.filter(
      (p: string) => p !== 'lib/secondary-in-repo-addon'
    );
  })
  .forEachScenario(scenario => {
    Qmodule(scenario.name, function (hooks) {
      throwOnWarnings(hooks);

      let app: PreparedApp;

      hooks.before(async () => {
        app = await scenario.prepare();
        // There is a bug in node-fixturify-project that means project.linkDependency() will cause
        // strange resolutions of dependencies. It is a timing issue where the peer depenceny checker
        // runs before the linked dependency has been fully written to disk and ends up giving us the
        // wrong answers. We are trying to recreate the same behaviour as linking a dependency with
        // this addDependency function because we still need to test this behaviour.
        //
        // when https://github.com/stefanpenner/node-fixturify-project/issues/100 is fixed we should
        // be able to go back to using depA.linkDependency()
        function addDependency(fromPkg: string, toPkg: string, projectDirectory: string) {
          let filename = join(projectDirectory, 'node_modules', fromPkg, 'package.json');
          let json = readJsonSync(filename);
          json.dependencies = {
            ...json.dependencies,
            [toPkg]: '*',
          };

          writeJsonSync(filename, json);
        }

        addDependency('dep-a', 'dep-c', app.dir);
        addDependency('dep-b', 'dep-c', app.dir);
      });

      test(`pnpm test: development`, async function (assert) {
        let result = await app.execute(`pnpm test`);
        assert.equal(result.exitCode, 0, result.output);
      });
    });
  });

stage2Scenarios
  .map('addon-ordering-is-preserved', app => {
    // these test attempt to describe the addon ordering behavior from ember-cli that was
    // introduced via: https://github.com/ember-cli/ember-cli/commit/098a9b304b551fe235bd42399ce6975af2a1bc48

    let depB = addAddon(app, 'dep-b');
    let depA = addAddon(app, 'dep-a');

    merge(depB.files, {
      app: {
        service: {
          'addon.js': 'export default "dep-b|service|addon.js";',
          'dep-wins-over-dev.js': 'export default "dep-b|service|dep-wins-over-dev.js";',
          'in-repo-over-deps.js': 'export default "dep-b|service|in-repo-over-deps.js";',
        },
      },
    });
    merge(depA.files, { app: { service: { 'addon.js': 'export default "dep-a|service|addon.js";' } } });

    addInRepoAddon(app, 'in-repo-a', {
      app: {
        service: {
          'in-repo.js': 'export default "in-repo-a|service|in-repo.js";',
          'in-repo-over-deps.js': 'export default "in-repo-a|service|in-repo-over-deps.js";',
        },
      },
    });
    addInRepoAddon(app, 'in-repo-b', {
      app: { service: { 'in-repo.js': 'export default "in-repo-b|service|in-repo.js";' } },
    });

    let devA = addDevAddon(app, 'dev-a');
    let devB = addDevAddon(app, 'dev-b');
    let devC = addDevAddon(app, 'dev-c');
    let devD = addDevAddon(app, 'dev-d');
    let devE = addDevAddon(app, 'dev-e');
    let devF = addDevAddon(app, 'dev-f');

    (devB.pkg['ember-addon'] as any).after = 'dev-e';
    (devF.pkg['ember-addon'] as any).before = 'dev-d';

    merge(devA.files, {
      app: {
        service: {
          'dev-addon.js': 'export default "dev-a|service|dev-addon.js";',
          'dep-wins-over-dev.js': 'export default "dev-a|service|dep-wins-over-dev.js";',
        },
      },
    });
    merge(devB.files, { app: { service: { 'test-after.js': 'export default "dev-b|service|test-after.js";' } } });
    merge(devC.files, { app: { service: { 'dev-addon.js': 'export default "dev-c|service|dev-addon.js";' } } });
    merge(devD.files, { app: { service: { 'test-before.js': 'export default "dev-d|service|test-before.js";' } } });
    merge(devE.files, { app: { service: { 'test-after.js': 'export default "dev-e|service|test-after.js";' } } });
    merge(devF.files, { app: { service: { 'test-before.js': 'export default "dev-f|service|test-before.js";' } } });

    merge(app.files, {
      services: {
        'store.js': `export { default } from 'ember-data/store';`,
      },
      tests: {
        unit: {
          'sorted-addons-win.js': `import { module, test } from 'qunit';

          import inRepoB from 'my-app/service/in-repo';
          import addonService from 'my-app/service/addon';
          import devAddon from 'my-app/service/dev-addon';
          import depWinsOverDev from 'my-app/service/dep-wins-over-dev';
          import inRepoOverDeps from 'my-app/service/in-repo-over-deps';
          import testBefore from 'my-app/service/test-before';
          import testAfter from 'my-app/service/test-after';

          module('Unit | basics', function () {
            test('in-repo-b comes from the right place', async function (assert) {
              assert.strictEqual(inRepoB, 'in-repo-b|service|in-repo.js');
            });

            test('addon-service comes from the right place', async function (assert) {
              assert.strictEqual(addonService, 'dep-b|service|addon.js');
            });

            test('dev-addon-service comes from the right place', async function (assert) {
              assert.strictEqual(devAddon, 'dev-c|service|dev-addon.js');
            });

            test('depWinsOverDev comes from the right place', async function (assert) {
              assert.strictEqual(depWinsOverDev, 'dep-b|service|dep-wins-over-dev.js');
            });

            test('inRepoOverDeps comes from the right place', async function (assert) {
              assert.strictEqual(inRepoOverDeps, 'in-repo-a|service|in-repo-over-deps.js');
            });

            test('testBefore comes from the right place', async function (assert) {
              assert.strictEqual(testBefore, 'dev-d|service|test-before.js');
            });

            test('testAfter comes from the right place', async function (assert) {
              assert.strictEqual(testAfter, 'dev-b|service|test-after.js');
            });
          })
          `,
        },
      },
    });
  })
  .forEachScenario(scenario => {
    Qmodule(scenario.name, function (hooks) {
      throwOnWarnings(hooks);

      let app: PreparedApp;
      hooks.before(async () => {
        app = await scenario.prepare();
      });

      test(`pnpm test: development`, async function (assert) {
        let result = await app.execute(`pnpm test`);
        assert.equal(result.exitCode, 0, result.output);
      });
    });
  });

stage2Scenarios
  .map('static-with-rules', app => {
    app.addDependency('some-library', '1.0.0');
    app.linkDependency('@embroider/sample-transforms', { baseDir: __dirname });

    let options: Options = {
      staticAddonTrees: false,
      amdCompatibility: {
        es: [['not-a-resolvable-package', ['default']]],
      },
      skipBabel: [
        {
          package: 'babel-filter-test1',
        },
        {
          package: 'babel-filter-test2',
          semverRange: '^4.0.0',
        },
        {
          package: 'babel-filter-test3',
          semverRange: '^2.0.0',
        },
      ],
      staticAppPaths: ['static-dir', 'top-level-static.js'],
      packageRules: [
        {
          package: 'my-addon',
          components: {
            '{{hello-world}}': {
              acceptsComponentArguments: [
                {
                  name: 'useDynamic',
                  becomes: 'dynamicComponentName',
                },
              ],
              layout: {
                addonPath: 'templates/components/hello-world.hbs',
              },
            },
          },
          addonModules: {
            'components/hello-world.js': {
              dependsOnModules: ['../synthetic-import-1'],
              dependsOnComponents: ['{{second-choice}}'],
            },
          },
          addonTemplates: {
            'templates/addon-example.hbs': {
              invokes: {
                'this.stuff': ['<SyntheticImport2 />'],
              },
            },
          },
          appModules: {
            'components/hello-world.js': {
              dependsOnModules: ['my-addon/synthetic-import-1'],
            },
          },
          appTemplates: {
            'templates/app-example.hbs': {
              invokes: {
                'this.stuff': ['<SyntheticImport2 />'],
              },
            },
          },
        },
      ],
    };

    merge(app.files, {
      'ember-cli-build.js': `
        'use strict';
        const EmberApp = require('ember-cli/lib/broccoli/ember-app');
        const { prebuild } = require('@embroider/compat');
        let opts = ${JSON.stringify(options)};
        module.exports = function (defaults) {
          let app = new EmberApp(defaults, {
            babel: {
              plugins: [require.resolve('ember-auto-import/babel-plugin')]
            }
          });

          return prebuild(app, {
            skipBabel: [
              {
                package: 'qunit',
              },
            ],
            ...opts
          });
        };
        `,
      app: {
        templates: {
          'index.hbs': `
          <HelloWorld @useDynamic="first-choice" />
          <HelloWorld @useDynamic={{"second-choice"}} />
          <HelloWorld @useDynamic={{component "third-choice"}} />
        `,
          'curly.hbs': `
          {{hello-world useDynamic="first-choice" }}
          {{hello-world useDynamic=(component "third-choice") }}
        `,
        },
        components: {
          'uses-inline-template.js': `
          import hbs from "htmlbars-inline-precompile";
          export default Component.extend({
            layout: hbs${'`'}<FirstChoice/>${'`'}
          })
          `,
          'first-choice.hbs': 'first',
          'second-choice.hbs': 'second',
          'third-choice.hbs': 'third',
          'module-name-check': {
            'index.hbs': '<div class={{embroider-sample-transforms-module}}>hello world</div>',
          },
        },
        'use-deep-addon.js': `import thing from 'deep-addon'`,
        'custom-babel-needed.js': `console.log('embroider-sample-transforms-target');`,
        'does-dynamic-import.js': `
          export default function() {
            return import('some-library');
          }
        `,
        helpers: {
          'embroider-sample-transforms-module.js': 'export default function() {}',
        },
        'static-dir': {
          'my-library.js': '',
        },
        'static-dir-not-really': {
          'something.js': '',
        },
        'non-static-dir': {
          'pull-some-things-into-the-build.js': `
            import '../components/uses-inline-template.js';
          `,
          'another-library.js': '',
        },
        'top-level-static.js': '',
      },
      public: {
        'public-file-1.txt': `initial state`,
      },
    });

    let addon = addAddon(app, 'my-addon');
    merge(addon.files, {
      addon: {
        components: {
          'hello-world.js': `
            import Component from '@ember/component';
            import layout from '../templates/components/hello-world';
            import computed from '@ember/object/computed';
            import somethingExternal from 'not-a-resolvable-package';
            export default Component.extend({
              dynamicComponentName: computed('useDynamic', function() {
                return this.useDynamic || 'default-dynamic';
              }),
              layout
            });
          `,
          'has-relative-template.js': `
            import Component from '@ember/component';
            import layout from './t';
            export default Component.extend({
              layout
            });
          `,
          't.hbs': ``,
          'uses-amd-require.js': `
            export default function() {
              require('some-package');
            }
          `,
        },
        'synthetic-import-1.js': '',
        templates: {
          'addon-example.hbs': '{{component this.stuff}}',
          components: {
            'hello-world.hbs': `
              {{component dynamicComponentName}}
            `,
          },
        },
      },
      app: {
        components: {
          'hello-world.js': `export { default } from 'my-addon/components/hello-world'`,
          'synthetic-import2.js': `export default function() {}`,
        },
        templates: {
          'app-example.hbs': `{{component this.stuff}}`,
        },
      },
      public: {
        'package.json': JSON.stringify({ customStuff: { fromMyAddon: true }, name: 'should-be-overridden' }),
      },
    });

    let deepAddon = addAddon(addon, 'deep-addon');
    merge(deepAddon.files, {
      addon: {
        'index.js': 'export default function() {}',
      },
    });

    app.addDependency('babel-filter-test1', '1.2.3').files = {
      'index.js': '',
    };

    app.addDependency('babel-filter-test2', '4.5.6').files = {
      'index.js': '',
    };

    app.addDependency('babel-filter-test3', '1.0.0').files = {
      'index.js': '',
    };

    app.addDependency('babel-filter-test4', '1.0.0').files = {
      'index.js': `
          module.exports = function() {
            return require('some-package');
          }
        `,
    };
  })
  .forEachScenario(scenario => {
    Qmodule(scenario.name, function (hooks) {
      throwOnWarnings(hooks);

      let app: PreparedApp;
      let server: CommandWatcher;
      let appURL: string;
      let expectFile: ExpectFile;
      let build: Transpiler;

      hooks.before(async () => {
        app = await scenario.prepare();
        server = CommandWatcher.launch('vite', ['--clearScreen', 'false'], { cwd: app.dir });
        [, appURL] = await server.waitFor(/Local:\s+(https?:\/\/.*)\//g);
      });

      hooks.beforeEach(assert => {
        expectFile = expectRewrittenFilesAt(app.dir, { qunit: assert });
        build = new Transpiler(app.dir);
      });

      hooks.after(async () => {
        await server?.shutdown();
      });

      let expectAudit = setupAuditTest(hooks, () => ({
        appURL,
        startingFrom: ['index.html'],
        fetch: fetch as unknown as typeof globalThis.fetch,
      }));

      test('no audit issues', function () {
        // among other things, this is asserting that dynamicComponent in
        // hello-world.hbs is not an error because the rules covered it
        expectAudit.hasNoFindings();
      });

      test('index.hbs', function (assert) {
        let expectModule = expectAudit.module('./templates/index.hbs');

        // explicit dependency
        expectModule
          .resolves(/my-addon\/_app_\/components\/hello-world/)
          .toModule()
          .codeContains('');

        // static component helper dependency
        expectModule
          .resolves(/\/components\/third-choice.hbs\/-embroider-pair-component/)
          .toModule()
          .withContents(contents => {
            assert.ok(
              /setComponentTemplate\(template, templateOnlyComponent\(undefined, "third-choice"\)\);/.test(contents)
            );
            return true;
          });

        // rule-driven string attribute
        expectModule
          .resolves(/\/components\/first-choice.hbs\/-embroider-pair-component/)
          .toModule()
          .withContents(contents => {
            assert.ok(
              /setComponentTemplate\(template, templateOnlyComponent\(undefined, "first-choice"\)\);/.test(contents)
            );
            return true;
          });

        // rule-driven mustache string literal
        expectModule
          .resolves(/\/components\/second-choice.hbs\/-embroider-pair-component/)
          .toModule()
          .withContents(contents => {
            assert.ok(
              /setComponentTemplate\(template, templateOnlyComponent\(undefined, "second-choice"\)\);/.test(contents)
            );
            return true;
          });
      });

      test('curly.hbs', function (assert) {
        let expectModule = expectAudit.module('./templates/curly.hbs');
        expectModule
          .resolves(/my-addon\/_app_\/components\/hello-world/)
          .toModule()
          .codeContains('');

        expectModule
          .resolves(/\/components\/third-choice.hbs\/-embroider-pair-component/)
          .toModule()
          .withContents(contents => {
            assert.ok(
              /setComponentTemplate\(template, templateOnlyComponent\(undefined, "third-choice"\)\);/.test(contents)
            );
            return true;
          });

        expectModule
          .resolves(/\/components\/first-choice.hbs\/-embroider-pair-component/)
          .toModule()
          .withContents(contents => {
            assert.ok(
              /setComponentTemplate\(template, templateOnlyComponent\(undefined, "first-choice"\)\);/.test(contents)
            );
            return true;
          });
      });

      test('app/hello-world.js', function (assert) {
        expectAudit
          .module('./templates/index.hbs')
          .resolves(/my-addon\/_app_\/components\/hello-world/)
          .toModule()
          .withContents(contents => {
            const [, importCompat] =
              /import (.*) from ".*@embroider\/macros\/src\/addon\/es-compat2.js.*";/.exec(contents) ?? [];
            const [, importName] =
              /import \* as (\w+) from ".*\/my-addon\/synthetic-import-1.js.*";/.exec(contents) ?? [];
            assert.ok(
              contents.includes(
                `window.define("my-addon/synthetic-import-1", function () {\n  return ${importCompat}(${importName});\n});`
              )
            );
            assert.ok(/export { default } from ".*my-addon\/components\/hello-world.js.*"/.test(contents));
            return true;
          });
      });

      test('addon/hello-world.js', function (assert) {
        const expectModule = expectAudit
          .module('./templates/index.hbs')
          .resolves(/my-addon\/_app_\/components\/hello-world/)
          .toModule()
          .resolves(/my-addon\/components\/hello-world\.js/) // remapped to precise copy of my-addon
          .toModule();

        expectModule.codeContains(`
          export default Component.extend({
            dynamicComponentName: computed('useDynamic', function () {
              return this.useDynamic || 'default-dynamic';
            }),
            layout
          });
        `);
        expectModule.withContents(contents => {
          const [, importCompat] =
            /import (.*) from ".*@embroider\/macros\/src\/addon\/es-compat2.js.*";/.exec(contents) ?? [];
          let [, importName] =
            /import \* as (\w+) from ".*\/components\/second-choice.hbs\/-embroider-pair-component";/.exec(contents) ??
            [];
          assert.ok(
            contents.includes(
              `window.define("my-app/components/second-choice", function () {\n  return ${importCompat}(${importName});\n});`
            )
          );
          [, importName] = /import \* as (\w+) from ".*\/my-addon\/synthetic-import-1.js.*";/.exec(contents) ?? [];
          assert.ok(
            contents.includes(
              `window.define("my-addon/synthetic-import-1", function () {\n  return ${importCompat}(${importName});\n});`
            )
          );
          return true;
        });
      });

      test('uses-inline-template.js', function (assert) {
        expectAudit
          .module('./components/uses-inline-template.js')
          .resolves(/\/components\/first-choice.hbs\/-embroider-pair-component/)
          .toModule()
          .withContents(contents => {
            assert.ok(
              /setComponentTemplate\(template, templateOnlyComponent\(undefined, "first-choice"\)\);/.test(contents)
            );
            return true;
          });
      });

      test('component with relative import of arbitrarily placed template', function () {
        expectAudit
          .module(/\/app\.js.*/)
          .resolves(/.*\/-embroider-entrypoint\.js/)
          .toModule()
          .resolves(/.*\/-embroider-implicit-modules\.js/)
          .toModule()
          .resolves(/my-addon\/components\/has-relative-template\.js/)
          .toModule()
          .resolves(/my-addon\/components\/t.js/)
          .toModule()
          .codeContains(`/* import __COLOCATED_TEMPLATE__ from './t.hbs'; */`);
      });

      test('app can import a deep addon', function () {
        expectAudit
          .module('./use-deep-addon.js')
          .resolves(/deep-addon\/index.js/)
          .toModule()
          .codeContains('export default function () {}');
      });

      test('amd require in an addon gets rewritten to window.require', function () {
        let assertFile = expectFile('node_modules/my-addon/components/uses-amd-require.js').transform(build.transpile);
        assertFile.matches(/window\.require\(['"]some-package['"]\)/, 'should find window.require');
      });

      test('cjs require in non-ember package does not get rewritten to window.require', function () {
        let assertFile = expectFile('node_modules/babel-filter-test4/index.js').transform(build.transpile);
        assertFile.matches(/return require\(['"]some-package['"]\)/, 'should find plain cjs require');
      });

      test('transpilation runs for ember addons', async function (assert) {
        assert.ok(build.shouldTranspile('node_modules/my-addon/components/has-relative-template.js'));
      });

      test('transpilation is skipped when package matches skipBabel', async function (assert) {
        assert.ok(!build.shouldTranspile('node_modules/babel-filter-test1/index.js'));
      });

      test('transpilation is skipped when package and version match skipBabel', async function (assert) {
        assert.ok(!build.shouldTranspile('node_modules/babel-filter-test2/index.js'));
      });

      test('transpilation runs when package version does not match skipBabel', async function (assert) {
        assert.ok(build.shouldTranspile('node_modules/babel-filter-test3/index.js'));
      });

      test('transpilation runs for non-ember package that is not explicitly skipped', async function (assert) {
        assert.ok(build.shouldTranspile('node_modules/babel-filter-test4/index.js'));
      });

      test(`app's babel plugins ran`, async function () {
        let assertFile = expectFile('custom-babel-needed.js').transform(build.transpile);
        assertFile.matches(/console\.log\(['"]embroider-sample-transforms-result['"]\)/);
      });

      test('dynamic import is preserved', function () {
        expectFile('./does-dynamic-import.js')
          .transform(build.transpile)
          .matches(/return import\(['"]some-library['"]\)/);
      });

      test('hbs transform sees expected module name', function () {
        let assertFile = expectFile('templates/components/module-name-check/index.hbs').transform(build.transpile);
        assertFile.matches(
          '"my-app/templates/components/module-name-check/index.hbs"',
          'our sample transform injected the expected moduleName into the compiled template'
        );
      });

      test('non-static other paths are included in the entrypoint', function (assert) {
        resolveEntryPoint(expectAudit).withContents(contents => {
          const result = /import \* as (\w+) from "\/non-static-dir\/another-library.js";/.exec(contents);

          if (!result) {
            throw new Error('Could not find import for non-static-dir/another-library');
          }

          const [, amdModule] = result;
          assert.ok(
            contents.includes(`"my-app/non-static-dir/another-library": ${amdModule}`),
            'expected module is in the export list'
          );
          return true;
        });
      });

      test('static other paths are not included in the entrypoint', function () {
        resolveEntryPoint(expectAudit).withContents(content => {
          return !/\.\/static-dir\/my-library\.js"/.test(content);
        });
      });

      test('top-level static other paths are not included in the entrypoint', function () {
        resolveEntryPoint(expectAudit).withContents(content => {
          return !content.includes('/top-level-static.js');
        });
      });

      test('staticAppPaths do not match partial path segments', function () {
        resolveEntryPoint(expectAudit).withContents(content => {
          return content.includes('/static-dir-not-really/something.js');
        });
      });

      test('invokes rule on appTemplates produces synthetic import', function () {
        expectAudit
          .module(/\/app\.js.*/)
          .resolves(/.*\/-embroider-entrypoint\.js/)
          .toModule()
          .resolves(/my-addon\/_app_\/templates\/app-example\.hbs.*/)
          .toModule()
          .resolves(/my-addon\/_app_\/components\/synthetic-import2\.js/)
          .toModule()
          .codeContains('export default function () {}');
      });

      test('invokes rule on addonTemplates produces synthetic import', function () {
        expectAudit
          .module(/\/app\.js.*/)
          .resolves(/.*\/-embroider-entrypoint\.js/)
          .toModule()
          .resolves(/.*\/-embroider-implicit-modules\.js/)
          .toModule()
          .resolves(/my-addon\/templates\/addon-example\.hbs/)
          .toModule()
          .resolves(/my-addon\/_app_\/components\/synthetic-import2\.js/)
          .toModule()
          .codeContains('export default function () {}');
      });
    });
  });

dummyAppScenarios
  .map('compat-stage2-addon-dummy-app', app => {
    renameApp(app, 'my-addon');
    app.linkDependency('@embroider/core', { baseDir: __dirname });
    app.linkDependency('@embroider/compat', { baseDir: __dirname });
    app.linkDependency('@embroider/webpack', { baseDir: __dirname });

    merge(app.files, {
      addon: {
        components: {
          'hello-world.js': `
              import { isDevelopingThisPackage } from '@embroider/macros';
              console.log(isDevelopingThisPackage());`,
        },
      },
      tests: {
        dummy: {
          app: {
            components: {
              'inside-dummy-app.js': `
                  import { isDevelopingThisPackage } from '@embroider/macros';
                  console.log(isDevelopingThisPackage());`,
            },
          },
        },
      },
    });
  })
  .forEachScenario(scenario => {
    Qmodule(scenario.name, function (hooks) {
      throwOnWarnings(hooks);

      let app: PreparedApp;
      let expectFile: ExpectFile;
      let build: Transpiler;

      hooks.before(async assert => {
        app = await scenario.prepare();
        let result = await app.execute('ember build', { env: { EMBROIDER_PREBUILD: 'true' } });
        assert.equal(result.exitCode, 0, result.output);
      });

      hooks.beforeEach(assert => {
        expectFile = expectRewrittenFilesAt(resolve(app.dir, 'tests/dummy'), { qunit: assert });
        build = new Transpiler(resolve(app.dir, 'tests/dummy'));
      });

      test('dummy app sees that its being developed', function () {
        let assertFile = expectFile('../../tmp/rewritten-app/components/inside-dummy-app.js').transform(
          build.transpile
        );
        assertFile.matches(/console\.log\(true\)/);
      });

      test('addon within dummy app sees that its being developed', function () {
        let assertFile = expectFile('../../components/hello-world.js').transform(build.transpile);
        assertFile.matches(/console\.log\(true\)/);
      });
    });
  });

function addAddon(app: Project, name: string) {
  let addon = baseAddon();
  addon.pkg.name = name;
  app.addDependency(addon);
  return addon;
}

function addDevAddon(app: Project, name: string) {
  let addon = baseAddon();
  addon.pkg.name = name;
  app.addDevDependency(addon);
  return addon;
}

function addInRepoAddon(app: Project, name: string, additionalFiles?: {}) {
  if (!app.pkg['ember-addon']) {
    app.pkg['ember-addon'] = {};
  }

  let pkg = app.pkg as any;

  if (!pkg['ember-addon'].paths) {
    pkg['ember-addon'].paths = [];
  }

  pkg['ember-addon'].paths.push(`lib/${name}`);

  merge(app.files, {
    lib: {
      [name]: {
        'package.json': JSON.stringify(
          {
            name,
            version: '0.0.0',
            keywords: ['ember-addon'],
          },
          null,
          2
        ),
        'index.js': `module.exports = {
          name: require('./package').name,
        };`,
        ...additionalFiles,
      },
    },
  });
}
