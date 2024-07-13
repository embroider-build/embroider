import type { PreparedApp } from 'scenario-tester';
import CommandWatcher from './helpers/command-watcher';
import { appScenarios, baseAddon } from './scenarios';
import fetch from 'node-fetch';
import QUnit from 'qunit';
const { module: Qmodule, test } = QUnit;

import { throwOnWarnings } from '@embroider/core';
import merge from 'lodash/merge';
import { setupAuditTest } from '@embroider/test-support/audit-assertions';

appScenarios
  .map('compat-renaming', app => {
    app.addDependency('a-library', { files: { 'index.js': '' } });
    merge(app.files, {
      'ember-cli-build.js': `'use strict';

      const EmberApp = require('ember-cli/lib/broccoli/ember-app');
      const { maybeEmbroider } = require('@embroider/test-setup');

      module.exports = function (defaults) {
        let app = new EmberApp(defaults, {});

        return maybeEmbroider(app, {
          staticAddonTrees: false,
          staticComponents: false,
          skipBabel: [
            {
              package: 'qunit',
            },
          ],
          // TODO remove this when we virtualise the entrypoint
          amdCompatibility: {
            es: [
              ["somebody-elses-package", ["default"]],
              ["somebody-elses-package/deeper", ["default"]],
              ["somebody-elses-package/environment", ["default"]],
              ["somebody-elses-package/utils", ["default"]],
              ["somebody-elses-package/utils/index", ["default"]],
            ]
          }
        });
      };
      `,
      app: {
        components: {
          'import-lodash.js': `
        import lodash from "lodash";
        `,
          'import-capitalize.js': `
        import capitalize from "lodash/capitalize";
        `,
          'import-own-thing.js': `
        import ownThing from "emits-multiple-packages/own-thing";
      `,
          'import-somebody-elses.js': `
        import environment from "somebody-elses-package/environment";
      `,
          'import-somebody-elses-utils.js': `
        import environment from "somebody-elses-package/utils";
      `,
          'import-somebody-elses-utils-index.js': `
        import environment from "somebody-elses-package/utils/index";
      `,
          'import-somebody-elses-utils-index-explicit.js': `
        import environment from "somebody-elses-package/utils/index.js";
      `,
          'import-somebody-elses-original.js': `
        import topLevel from "somebody-elses-package";
        import deeper from "somebody-elses-package/deeper";
      `,
          'import-single-file-package.js': `
        import whatever from 'single-file-package';
      `,
        },
      },
    });

    let emberLodash = baseAddon();
    emberLodash.pkg.name = 'ember-lodash';
    merge(emberLodash.files, {
      'index.js': `
        module.exports = {
          name: require('./package.json').name,
          moduleName() { return 'lodash'; }
        }
      `,
      addon: {
        'index.js': `// lodash index\nexport default function() {}`,
        'capitalize.js': `// lodash capitalize\nexport default function() {}`,
      },
    });
    app.addDevDependency(emberLodash);

    let emitsMultiple = baseAddon();
    emitsMultiple.pkg.name = 'emits-multiple-packages';
    merge(emitsMultiple.files, {
      'index.js': `
        module.exports = {
          name: require('./package.json').name,
          treeForAddon(tree) {
            // doesn't call super so we can escape our namespace
            return tree;
          }
        }
      `,
      addon: {
        'emits-multiple-packages': {
          'own-thing.js': '// own thing\nexport default function() {}',
        },
        'somebody-elses-package': {
          'environment.js': '// somebody elses environment\nexport default function() {}',
          utils: {
            'index.js': '// somebody elses utils\nexport default function() {}',
          },
        },
        'single-file-package.js': '// single file package\nexport default function() {}',
      },
    });
    app.addDependency(emitsMultiple);

    let firstAddonWithAppTreeImport = baseAddon();
    firstAddonWithAppTreeImport.pkg.name = 'has-app-tree-import';
    app.addDevDependency(firstAddonWithAppTreeImport);
    merge(firstAddonWithAppTreeImport.files, {
      app: {
        'first.js': `export { default } from 'has-app-tree-import';`,
        'imports-dep.js': `export { default } from 'inner-dep';`,
      },
      addon: {
        'index.js': `export default "first-copy";`,
      },
    });

    let innerDep = baseAddon();
    innerDep.pkg.name = 'inner-dep';
    firstAddonWithAppTreeImport.addDependency(innerDep);
    merge(innerDep.files, {
      addon: {
        'index.js': `export default "inner-dep";`,
      },
    });

    let secondAddonWithAppTreeImport = baseAddon();
    secondAddonWithAppTreeImport.pkg.name = 'has-app-tree-import';
    merge(secondAddonWithAppTreeImport.files, {
      app: {
        'second.js': `export { default } from 'has-app-tree-import';`,
      },
      addon: {
        'index.js': `export default "second-copy";`,
      },
    });
    let intermediate = baseAddon();
    intermediate.pkg.name = 'intermediate';
    intermediate.addDependency(secondAddonWithAppTreeImport);
    app.addDevDependency(intermediate);

    // an addon that emits code from its own app tree that is really authored as
    // part of the app and therefore does thing like refer to the app's modules
    // by the app's package name
    let mirageLike = baseAddon();
    mirageLike.pkg.name = 'mirage-like';
    app.addDevDependency(mirageLike);
    merge(mirageLike.files, {
      app: {
        mirage: {
          'config.js': `
            import "app-template/components/import-lodash";
            import "a-library";
          `,
        },
      },
    });
  })
  .forEachScenario(scenario => {
    Qmodule(scenario.name, function (hooks) {
      throwOnWarnings(hooks);

      let app: PreparedApp;
      let server: CommandWatcher;
      let appURL: string;

      hooks.before(async () => {
        app = await scenario.prepare();
        server = CommandWatcher.launch('vite', ['--clearScreen', 'false'], { cwd: app.dir });
        [, appURL] = await server.waitFor(/Local:\s+(https?:\/\/.*)\//g);
      });

      hooks.after(async () => {
        await server?.shutdown();
      });

      let expectAudit = setupAuditTest(hooks, () => ({
        appURL,
        startingFrom: ['index.html'],
        fetch: fetch as unknown as typeof globalThis.fetch,
      }));

      test('audit issues', function () {
        expectAudit.hasNoFindings();
      });

      test('whole package renaming works for top-level module', function () {
        expectAudit
          .module('./components/import-lodash.js')
          .resolves(/ember-lodash\/index.js/)
          .toModule()
          .codeContains('// lodash index');
      });

      test('whole package renaming works for interior module', function () {
        expectAudit
          .module('./components/import-capitalize.js')
          .resolves(/ember-lodash\/capitalize.js/)
          .toModule()
          .codeContains('// lodash capitalize');
      });

      test("modules in own namespace don't get renamed", function () {
        expectAudit
          .module('./components/import-own-thing.js')
          .resolves(/emits-multiple-packages\/own-thing.js/)
          .toModule()
          .codeContains('// own thing');
      });

      test('modules outside our namespace do get renamed', function () {
        expectAudit
          .module('./components/import-somebody-elses.js')
          .resolves(/somebody-elses-package\/environment.js/)
          .toModule()
          .codeContains('// somebody elses environment');
      });

      test('modules outside our namespace do get renamed, with index.js', function () {
        expectAudit
          .module('./components/import-somebody-elses-utils.js')
          .resolves(/somebody-elses-package\/utils\/index.js/)
          .toModule()
          .codeContains('// somebody elses utils');
      });

      test('modules outside our namespace do get renamed, with index', function () {
        expectAudit
          .module('./components/import-somebody-elses-utils-index.js')
          .resolves(/somebody-elses-package\/utils\/index.js/)
          .toModule()
          .codeContains('// somebody elses utils');
      });
      test('modules outside our namespace do get renamed, with index with extension', function () {
        expectAudit
          .module('./components/import-somebody-elses-utils-index-explicit.js')
          .resolves(/somebody-elses-package\/utils\/index.js/)
          .toModule()
          .codeContains('// somebody elses utils');
      });
      test('renamed modules keep their classic runtime name when used as implicit-modules', function (assert) {
        expectAudit
          .module('./index.html')
          .resolves(/\/index.html.*/) // in-html app-boot script
          .toModule()
          .resolves(/\/app\.js.*/)
          .toModule()
          .resolves(/.*\/-embroider-entrypoint\.js/)
          .toModule()
          .resolves(/.*\/-embroider-implicit-modules\.js/)
          .toModule()
          .withContents(contents => {
            const [, objectName] = /"somebody-elses-package\/environment": (own\d+),/.exec(contents) ?? [];

            let testPattern = new RegExp(
              `import \\* as ${objectName} from ".*emits-multiple-packages/somebody-elses-package/environment.js.*";`
            );

            assert.ok(testPattern.test(contents));

            return true;
          }, 'module imports from the correct place and exports object with the right key');
      });
      // TODO: is this test still valid?
      test('rewriting one module does not capture entire package namespace', function () {
        expectAudit
          .module('./components/import-somebody-elses-original.js')
          .resolves(/@embroider\/ext-es\/somebody-elses-package\/exports=default/)
          .toModule()
          .codeContains('const m = window.require("somebody-elses-package");');

        expectAudit
          .module('./components/import-somebody-elses-original.js')
          .resolves(/@embroider\/ext-es\/somebody-elses-package\/deeper\/exports=default/)
          .toModule()
          .codeContains('const m = window.require("somebody-elses-package/deeper");');
      });
      test('single file package gets captured and renamed', function () {
        expectAudit
          .module('./components/import-single-file-package.js')
          .resolves(/single-file-package\/index.js/)
          .toModule()
          .codeContains('// single file package');
      });
      // TODO: in all the changes below,
      // was the .to('./node_modules/has-app-tree-import/index.js') step important?
      test('files logically copied into app from addons resolve their own original packages', function () {
        expectAudit
          .module(/has-app-tree-import\/_app_\/first.js/)
          .resolves(/has-app-tree-import\/index.js/)
          .toModule()
          .codeContains('export default "first-copy";');
        expectAudit
          .module(/has-app-tree-import\/_app_\/second.js/)
          .resolves(/has-app-tree-import\/index.js/)
          .toModule()
          .codeContains('export default "second-copy";');
      });
      test(`files logically copied into app from addons resolve the addon's deps`, function () {
        expectAudit
          .module(/has-app-tree-import\/_app_\/imports-dep\.js/)
          .resolves(/inner-dep\/index\.js/)
          .toModule()
          .codeContains('export default "inner-dep";');
      });
      test(`app-tree files from addons can import from the app`, function (assert) {
        expectAudit
          .module(/mirage-like\/_app_\/mirage\/config\.js/)
          .resolves(/components\/import-lodash\.js/)
          .toModule()
          .withContents(contents => {
            assert.ok(/import lodash from ".*";/.test(contents));
            return true;
          });
      });
      test(`files logically copied into app from addons can resolve the app's deps`, function () {
        expectAudit
          .module(/mirage-like\/_app_\/mirage\/config.js/)
          .resolves(/a-library\/index\.js/)
          .toModule()
          .codeContains('');
      });
    });
  });
