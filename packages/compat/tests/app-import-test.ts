import 'qunit';
import { Project, BuildResult, installFileAssertions } from '@embroider/test-support';

import { throwOnWarnings } from '@embroider/core';

QUnit.module('app.import tests', function(origHooks) {
  let { hooks, test } = installFileAssertions(origHooks);
  let build: BuildResult;

  throwOnWarnings(hooks);

  hooks.before(async function(assert) {
    let app = Project.emberNew();

    let addon = app.addAddon(
      'my-addon',
      `
      included() {
        this._super.included.apply(this, arguments);
        this.import('vendor/some-font.ttf', { destDir: 'fonts' });
      }
    `
    );
    addon.files.vendor = {
      'some-font.ttf': `some font`,
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

  test('destDir puts vendor files into public assets', function(assert) {
    let assertFile = assert.file('node_modules/@embroider/synthesized-vendor/package.json').json();
    assertFile.get(['ember-addon', 'public-assets', 'vendor/some-font.ttf']).equals('fonts/some-font.ttf');
    assert.file('node_modules/@embroider/synthesized-vendor/vendor/some-font.ttf').exists();
  });
});
