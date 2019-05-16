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
    };

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
  });
  test('whole package renaming works for interior module', function(assert) {
    let assertFile = assert.file('components/import-capitalize.js').transform(build.transpile);
    assertFile.matches(/import capitalize from ["']ember-lodash\/capitalize["']/);
  });
});
