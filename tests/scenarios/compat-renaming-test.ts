import { PreparedApp } from 'scenario-tester';
import { appScenarios, baseAddon } from './scenarios';
import { readFileSync } from 'fs';
import { join } from 'path';
import QUnit from 'qunit';
const { module: Qmodule, test } = QUnit;

import { definesPattern, ExpectFile, expectFilesAt, Transpiler } from '@embroider/test-support';

import { throwOnWarnings } from '@embroider/core';
import merge from 'lodash/merge';
import { Audit, AuditResults } from '@embroider/compat/src/audit';

appScenarios
  .map('compat-renaming', app => {
    app.addDependency('a-library', { files: { 'index.js': '' } });
    merge(app.files, {
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

    let somebodyElses = baseAddon();
    somebodyElses.pkg.name = 'somebody-elses-package';
    app.addDevDependency(somebodyElses);

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
        'index.js': `// lodash index`,
        'capitalize.js': `// lodash capitalize`,
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
          'own-thing.js': '// own thing',
        },
        'somebody-elses-package': {
          'environment.js': '// somebody elses environment',
          utils: {
            'index.js': '// somebody elses utils',
          },
        },
        'single-file-package.js': '// single file package',
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
      let expectAudit: ExpectAuditResults;
      let build: Transpiler;
      let result: AuditResults;

      class ExpectAuditResults {
        constructor(private result: AuditResults, private assert: Assert) {}

        module(name: string) {
          let m = this.result.modules[name];
          if (!m) {
            this.assert.pushResult({
              result: false,
              actual: `${name} is not in audit results`,
              expected: `${name} in audit results`,
            });
          }
          return new ExpectModule(this.assert, m);
        }
      }

      class ExpectModule {
        constructor(private assert: Assert, private module: AuditResults['modules'][string] | undefined) {}

        resolves(specifier: string) {
          return {
            to: (filename: string) => {
              if (this.module) {
                if (specifier in this.module.resolutions) {
                  this.assert.pushResult({
                    result: this.module.resolutions[specifier] === filename,
                    expected: filename,
                    actual: this.module.resolutions[specifier],
                  });
                } else {
                  this.assert.pushResult({
                    result: false,
                    expected: specifier,
                    actual: Object.keys(this.module.resolutions),
                  });
                }
              }
            },
          };
        }
      }

      hooks.before(async () => {
        app = await scenario.prepare();
        result = await Audit.run({ app: app.dir, 'reuse-build': false });
      });

      hooks.beforeEach(assert => {
        expectFile = expectFilesAt(readFileSync(join(app.dir, 'dist/.stage2-output'), 'utf8'), { qunit: assert });
        expectAudit = new ExpectAuditResults(result, assert);
        build = new Transpiler(expectFile.basePath);
      });

      test('whole package renaming works for top-level module', function (assert) {
        expectAudit
          .module('./components/import-lodash.js')
          .resolves('lodash')
          .to('./node_modules/ember-lodash/index.js');
        assert.equal(
          result.modules['./components/import-lodash.js']?.resolutions['lodash'],
          './node_modules/ember-lodash/index.js'
        );
        expectFile('node_modules/ember-lodash/index.js').matches(/lodash index/);
      });

      test('whole package renaming works for interior module', function () {
        expectAudit
          .module('./components/import-capitalize.js')
          .resolves('lodash/capitalize')
          .to('./node_modules/ember-lodash/capitalize.js');

        expectFile('node_modules/ember-lodash/capitalize.js').matches(/lodash capitalize/);
      });

      test("modules in own namespace don't get renamed", function () {
        expectAudit
          .module('./components/import-own-thing.js')
          .resolves('emits-multiple-packages/own-thing')
          .to('./node_modules/emits-multiple-packages/own-thing.js');
        expectFile('node_modules/emits-multiple-packages/own-thing.js').matches(/own thing/);
      });

      test('modules outside our namespace do get renamed', function () {
        expectAudit
          .module('./components/import-somebody-elses.js')
          .resolves('somebody-elses-package/environment')
          .to('./node_modules/emits-multiple-packages/somebody-elses-package/environment.js');
        expectFile('node_modules/emits-multiple-packages/somebody-elses-package/environment.js').matches(
          /somebody elses environment/
        );
      });

      test('modules outside our namespace do get renamed, with index.js', function () {
        expectAudit
          .module('./components/import-somebody-elses-utils.js')
          .resolves('somebody-elses-package/utils')
          .to('./node_modules/emits-multiple-packages/somebody-elses-package/utils/index.js');
        expectFile('node_modules/emits-multiple-packages/somebody-elses-package/utils/index.js').matches(
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
        let assertFile = expectFile('components/import-somebody-elses-utils-index-explicit.js').transform(
          build.transpile
        );
        assertFile.matches(
          /import environment from ["']emits-multiple-packages\/somebody-elses-package\/utils\/index\.js["']/
        );
      });
      test('renamed modules keep their classic runtime name when used as implicit-modules', function () {
        let assertFile = expectFile('assets/app-template.js').transform(build.transpile);
        assertFile.matches(
          definesPattern(
            'somebody-elses-package/environment',
            '../node_modules/emits-multiple-packages/somebody-elses-package/environment'
          )
        );
      });
      test('rewriting one modules does not capture entire package namespace', function () {
        let assertFile = expectFile('components/import-somebody-elses-original.js').transform(build.transpile);
        assertFile.matches(/import topLevel from ["']somebody-elses-package["']/);
        assertFile.matches(/import deeper from ["']somebody-elses-package\/deeper["']/);
      });
      test('single file package gets captured and renamed', function () {
        let assertFile = expectFile('components/import-single-file-package.js').transform(build.transpile);
        assertFile.matches(/import whatever from ["']emits-multiple-packages\/single-file-package\/index.js['"]/);
        expectFile('./node_modules/emits-multiple-packages/single-file-package/index.js').matches(
          /single file package/
        );
      });
      test('files copied into app from addons resolve their own original packages', function () {
        let assertFile = expectFile('first.js').transform(build.transpile);
        assertFile.matches(/export \{ default \} from ['"]\.\/node_modules\/has-app-tree-import['"]/);

        assertFile = expectFile('second.js').transform(build.transpile);
        assertFile.matches(
          /export \{ default \} from ['"]\.\/node_modules\/intermediate\/node_modules\/has-app-tree-import['"]/
        );
      });
      test(`files copied into app from addons resolve the addon's deps`, function () {
        let assertFile = expectFile('imports-dep.js').transform(build.transpile);
        assertFile.matches(
          /export \{ default \} from ['"]\.\/node_modules\/has-app-tree-import\/node_modules\/inner-dep['"]/
        );
      });
      test(`app-tree files from addons that import from the app get rewritten to relative imports`, function () {
        let assertFile = expectFile('mirage/config.js').transform(build.transpile);
        assertFile.matches(/import ['"]\.\.\/components\/import-lodash['"]/);
      });
      test(`files copied into app from addons can resolve the app's deps`, function () {
        let assertFile = expectFile('mirage/config.js').transform(build.transpile);
        assertFile.matches(/import ['"]a-library['"]/);
      });
    });
  });
