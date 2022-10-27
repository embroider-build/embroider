import { PreparedApp } from 'scenario-tester';
import { appScenarios, baseAddon } from './scenarios';
import { readFileSync } from 'fs';
import { join } from 'path';
import QUnit from 'qunit';
const { module: Qmodule, test } = QUnit;

import { definesPattern, ExpectFile, expectFilesAt, Transpiler } from '@embroider/test-support';

import { throwOnWarnings } from '@embroider/core';
import merge from 'lodash/merge';

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
      let build: Transpiler;

      hooks.before(async assert => {
        app = await scenario.prepare();
        let result = await app.execute('ember build', { env: { STAGE2_ONLY: 'true' } });
        assert.equal(result.exitCode, 0, result.output);
      });

      hooks.beforeEach(assert => {
        expectFile = expectFilesAt(readFileSync(join(app.dir, 'dist/.stage2-output'), 'utf8'), { qunit: assert });
        build = new Transpiler(expectFile.basePath);
      });

      test('whole package renaming works for top-level module', function () {
        let assertFile = expectFile('components/import-lodash.js').transform(build.transpile);
        assertFile.matches(/import lodash from ["']ember-lodash["']/);
        expectFile('node_modules/ember-lodash/index.js').matches(/lodash index/);
      });
      test('whole package renaming works for interior module', function () {
        let assertFile = expectFile('components/import-capitalize.js').transform(build.transpile);
        assertFile.matches(/import capitalize from ["']ember-lodash\/capitalize["']/);
        expectFile('node_modules/ember-lodash/capitalize.js').matches(/lodash capitalize/);
      });
      test("modules in own namespace don't get renamed", function () {
        let assertFile = expectFile('components/import-own-thing.js').transform(build.transpile);
        assertFile.matches(/import ownThing from ["']emits-multiple-packages\/own-thing["']/);
        expectFile('node_modules/emits-multiple-packages/own-thing.js').matches(/own thing/);
      });
      test('modules outside our namespace do get renamed', function () {
        let assertFile = expectFile('components/import-somebody-elses.js').transform(build.transpile);
        assertFile.matches(
          /import environment from ["']emits-multiple-packages\/somebody-elses-package\/environment(\.js)?["']/
        );
        expectFile('node_modules/emits-multiple-packages/somebody-elses-package/environment.js').matches(
          /somebody elses environment/
        );
      });
      test('modules outside our namespace do get renamed, with index.js', function () {
        let assertFile = expectFile('components/import-somebody-elses-utils.js').transform(build.transpile);
        assertFile.matches(
          /import environment from ["']emits-multiple-packages\/somebody-elses-package\/utils\/index\.js["']/
        );
        expectFile('node_modules/emits-multiple-packages/somebody-elses-package/utils/index.js').matches(
          /somebody elses utils/
        );
      });
      test('modules outside our namespace do get renamed, with index', function () {
        let assertFile = expectFile('components/import-somebody-elses-utils-index.js').transform(build.transpile);
        assertFile.matches(
          /import environment from ["']emits-multiple-packages\/somebody-elses-package\/utils\/index\.js["']/
        );
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
