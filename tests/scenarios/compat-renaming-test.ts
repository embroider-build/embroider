import type { PreparedApp } from 'scenario-tester';
import { appScenarios, baseAddon } from './scenarios';
import QUnit from 'qunit';
import { resolve, sep } from 'path';
const { module: Qmodule, test } = QUnit;

import type { ExpectFile } from '@embroider/test-support/file-assertions/qunit';
import { expectRewrittenFilesAt } from '@embroider/test-support/file-assertions/qunit';

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
      let expectFile: ExpectFile;

      hooks.before(async () => {
        app = await scenario.prepare();
      });

      hooks.beforeEach(assert => {
        expectFile = expectRewrittenFilesAt(app.dir, { qunit: assert });
      });

      let expectAudit = setupAuditTest(hooks, () => ({ app: app.dir }));

      test('audit issues', function () {
        expectAudit.hasNoFindings();
      });

      test('whole package renaming works for top-level module', function () {
        expectAudit
          .module('./components/import-lodash.js')
          .resolves('lodash')
          .to('./node_modules/ember-lodash/index.js');
        expectFile('./node_modules/ember-lodash/index.js').matches(/lodash index/);
      });

      test('whole package renaming works for interior module', function () {
        expectAudit
          .module('./components/import-capitalize.js')
          .resolves('lodash/capitalize')
          .to('./node_modules/ember-lodash/capitalize.js');

        expectFile('./node_modules/ember-lodash/capitalize.js').matches(/lodash capitalize/);
      });

      test("modules in own namespace don't get renamed", function () {
        expectAudit
          .module('./components/import-own-thing.js')
          .resolves('emits-multiple-packages/own-thing')
          .to('./node_modules/emits-multiple-packages/own-thing.js');
        expectFile('./node_modules/emits-multiple-packages/own-thing.js').matches(/own thing/);
      });

      test('modules outside our namespace do get renamed', function () {
        expectAudit
          .module('./components/import-somebody-elses.js')
          .resolves('somebody-elses-package/environment')
          .to('./node_modules/emits-multiple-packages/somebody-elses-package/environment.js');
        expectFile('./node_modules/emits-multiple-packages/somebody-elses-package/environment.js').matches(
          /somebody elses environment/
        );
      });

      test('modules outside our namespace do get renamed, with index.js', function () {
        expectAudit
          .module('./components/import-somebody-elses-utils.js')
          .resolves('somebody-elses-package/utils')
          .to('./node_modules/emits-multiple-packages/somebody-elses-package/utils/index.js');
        expectFile('./node_modules/emits-multiple-packages/somebody-elses-package/utils/index.js').matches(
          /somebody elses utils/
        );
      });

      test('modules outside our namespace do get renamed, with index', function () {
        expectAudit
          .module('./components/import-somebody-elses-utils-index.js')
          .resolves('somebody-elses-package/utils/index')
          .to('./node_modules/emits-multiple-packages/somebody-elses-package/utils/index.js');
      });
      test('modules outside our namespace do get renamed, with index with extension', function () {
        expectAudit
          .module('./components/import-somebody-elses-utils-index-explicit.js')
          .resolves('somebody-elses-package/utils/index.js')
          .to('./node_modules/emits-multiple-packages/somebody-elses-package/utils/index.js');
      });
      test('renamed modules keep their classic runtime name when used as implicit-modules', function () {
        expectAudit
          .module('./node_modules/.embroider/rewritten-app/index.html')
          .resolves('/assets/app-template.js')
          .toModule()
          .resolves('./-embroider-implicit-modules.js')
          .toModule()
          .withContents(contents => {
            const [, objectName] = /"somebody-elses-package\/environment": (own\d+),/.exec(contents) ?? [];

            return contents.includes(
              `import * as ${objectName} from "emits-multiple-packages/somebody-elses-package/environment";`
            );
          }, 'module imports from the correct place and exports object with the right key');
      });
      test('rewriting one module does not capture entire package namespace', function () {
        expectAudit
          .module('./components/import-somebody-elses-original.js')
          .resolves('somebody-elses-package')
          .to(resolve('/@embroider/ext-es/somebody-elses-package?exports=default').split(sep).join('/'));

        expectAudit
          .module('./components/import-somebody-elses-original.js')
          .resolves('somebody-elses-package/deeper')
          .to(resolve('/@embroider/ext-es/somebody-elses-package/deeper?exports=default').split(sep).join('/'));
      });
      test('single file package gets captured and renamed', function () {
        expectAudit
          .module('./components/import-single-file-package.js')
          .resolves('single-file-package')
          .to('./node_modules/emits-multiple-packages/single-file-package/index.js');
        expectFile('./node_modules/emits-multiple-packages/single-file-package/index.js').matches(
          /single file package/
        );
      });
      test('files logically copied into app from addons resolve their own original packages', function () {
        expectAudit
          .module('./node_modules/has-app-tree-import/_app_/first.js')
          .resolves('has-app-tree-import')
          .to('./node_modules/has-app-tree-import/index.js');
        expectAudit
          .module('./node_modules/intermediate/node_modules/has-app-tree-import/_app_/second.js')
          .resolves('has-app-tree-import')
          .to('./node_modules/intermediate/node_modules/has-app-tree-import/index.js');
      });
      test(`files logically copied into app from addons resolve the addon's deps`, function () {
        expectAudit
          .module('./node_modules/has-app-tree-import/_app_/imports-dep.js')
          .resolves('inner-dep')
          .to('./node_modules/has-app-tree-import/node_modules/inner-dep/index.js');
      });
      test(`app-tree files from addons can import from the app`, function () {
        expectAudit
          .module('./node_modules/mirage-like/_app_/mirage/config.js')
          .resolves('app-template/components/import-lodash')
          .to('./components/import-lodash.js');
      });
      test(`files logically copied into app from addons can resolve the app's deps`, function () {
        expectAudit
          .module('./node_modules/mirage-like/_app_/mirage/config.js')
          .resolves('a-library')
          .to('./node_modules/a-library/index.js');
      });
    });
  });
