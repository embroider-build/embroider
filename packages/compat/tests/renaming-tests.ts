import 'qunit';
import { Project, BuildResult, installFileAssertions } from '@embroider/test-support';

import { throwOnWarnings } from '@embroider/core';

QUnit.module('renaming tests', function(origHooks) {
  let { hooks, test } = installFileAssertions(origHooks);
  let build: BuildResult;

  throwOnWarnings(hooks);

  hooks.before(async function(assert) {
    let app = Project.emberNew();

    (app.files.app as Project['files']).components = {
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
    };
    app.addAddon('somebody-elses-package');

    let addon = app.addAddon(
      'ember-lodash',
      `
      moduleName() { return 'lodash'; }
    `
    );
    addon.files.addon = {
      'index.js': `// lodash index`,
      'capitalize.js': `// lodash capitalize`,
    };

    addon = app.addAddon(
      'emits-multiple-packages',
      `
      treeForAddon(tree) {
        // doesn't call super so we can escape our namespace
        return tree;
      }
      `
    );

    addon.files.addon = {
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
    };

    let firstAddonWithAppTreeImport = app.addAddon('has-app-tree-import');
    (firstAddonWithAppTreeImport.files.app as Project['files'])[
      'first.js'
    ] = `export { default } from 'has-app-tree-import';`;
    (firstAddonWithAppTreeImport.files.app as Project['files'])[
      'imports-dep.js'
    ] = `export { default } from 'inner-dep';`;
    (firstAddonWithAppTreeImport.files.addon as Project['files'])['index.js'] = `export default "first-copy";`;

    let innerDep = firstAddonWithAppTreeImport.addAddon('inner-dep');
    (innerDep.files.addon as Project['files'])['index.js'] = `export default "inner-dep";`;

    let secondAddonWithAppTreeImport = app.addAddon('intermediate').addAddon('has-app-tree-import');
    (secondAddonWithAppTreeImport.files.app as Project['files'])[
      'second.js'
    ] = `export { default } from 'has-app-tree-import';`;
    (secondAddonWithAppTreeImport.files.addon as Project['files'])['index.js'] = `export default "second-copy";`;

    build = await BuildResult.build(app, {
      stage: 2,
      type: 'app',
      emberAppOptions: {
        tests: false,
      },
    });
    assert.basePath = build.outputPath;
  });

  hooks.after(async function() {
    await build.cleanup();
  });

  test('whole package renaming works for top-level module', function(assert) {
    let assertFile = assert.file('components/import-lodash.js').transform(build.transpile);
    assertFile.matches(/import lodash from ["']ember-lodash["']/);
    assert.file('node_modules/ember-lodash/index.js').matches(/lodash index/);
  });
  test('whole package renaming works for interior module', function(assert) {
    let assertFile = assert.file('components/import-capitalize.js').transform(build.transpile);
    assertFile.matches(/import capitalize from ["']ember-lodash\/capitalize["']/);
    assert.file('node_modules/ember-lodash/capitalize.js').matches(/lodash capitalize/);
  });
  test("modules in own namespace don't get renamed", function(assert) {
    let assertFile = assert.file('components/import-own-thing.js').transform(build.transpile);
    assertFile.matches(/import ownThing from ["']emits-multiple-packages\/own-thing["']/);
    assert.file('node_modules/emits-multiple-packages/own-thing.js').matches(/own thing/);
  });
  test('modules outside our namespace do get renamed', function(assert) {
    let assertFile = assert.file('components/import-somebody-elses.js').transform(build.transpile);
    assertFile.matches(
      /import environment from ["']emits-multiple-packages\/somebody-elses-package\/environment(\.js)?["']/
    );
    assert
      .file('node_modules/emits-multiple-packages/somebody-elses-package/environment.js')
      .matches(/somebody elses environment/);
  });
  test('modules outside our namespace do get renamed, with index.js', function(assert) {
    let assertFile = assert.file('components/import-somebody-elses-utils.js').transform(build.transpile);
    assertFile.matches(
      /import environment from ["']emits-multiple-packages\/somebody-elses-package\/utils\/index\.js["']/
    );
    assert
      .file('node_modules/emits-multiple-packages/somebody-elses-package/utils/index.js')
      .matches(/somebody elses utils/);
  });
  test('modules outside our namespace do get renamed, with index', function(assert) {
    let assertFile = assert.file('components/import-somebody-elses-utils-index.js').transform(build.transpile);
    assertFile.matches(
      /import environment from ["']emits-multiple-packages\/somebody-elses-package\/utils\/index\.js["']/
    );
  });
  test('modules outside our namespace do get renamed, with index with extension', function(assert) {
    let assertFile = assert.file('components/import-somebody-elses-utils-index-explicit.js').transform(build.transpile);
    assertFile.matches(
      /import environment from ["']emits-multiple-packages\/somebody-elses-package\/utils\/index\.js["']/
    );
  });
  test('rewriting one modules does not capture entire package namespace', function(assert) {
    let assertFile = assert.file('components/import-somebody-elses-original.js').transform(build.transpile);
    assertFile.matches(/import topLevel from ["']somebody-elses-package["']/);
    assertFile.matches(/import deeper from ["']somebody-elses-package\/deeper["']/);
  });
  test('single file package gets captured and renamed', function(assert) {
    let assertFile = assert.file('components/import-single-file-package.js').transform(build.transpile);
    assertFile.matches(/import whatever from ["']emits-multiple-packages\/single-file-package\/index.js['"]/);
    assert.file('./node_modules/emits-multiple-packages/single-file-package/index.js').matches(/single file package/);
  });
  test('files copied into app from addons resolve their own original packages', function(assert) {
    let assertFile = assert.file('first.js').transform(build.transpile);
    assertFile.matches(/export \{ default \} from ['"]\.\/node_modules\/has-app-tree-import['"]/);

    assertFile = assert.file('second.js').transform(build.transpile);
    assertFile.matches(
      /export \{ default \} from ['"]\.\/node_modules\/intermediate\/node_modules\/has-app-tree-import['"]/
    );
  });
  test(`files copied into app from addons resolve the addon's deps`, function(assert) {
    let assertFile = assert.file('imports-dep.js').transform(build.transpile);
    assertFile.matches(
      /export \{ default \} from ['"]\.\/node_modules\/has-app-tree-import\/node_modules\/inner-dep['"]/
    );
  });
});
