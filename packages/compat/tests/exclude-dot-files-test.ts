import 'qunit';
import { Project, BuildResult, installFileAssertions } from '@embroider/test-support';
import { throwOnWarnings } from '@embroider/core';

QUnit.module('dot files are excluded as modules from apps and addons', function(origHooks) {
  let { hooks, test } = installFileAssertions(origHooks);
  let build: BuildResult;
  let app: Project;

  throwOnWarnings(hooks);

  hooks.before(async function(assert) {
    app = Project.emberNew();
    app.files.app = Object.assign({}, app.files.app, {
      '.foobar.js': `foobar content`,
      '.barbaz.js': `barbaz content`,
      'bizbiz.js': `bizbiz content`,
    });

    let addon = app.addAddon('my-addon');

    addon.files.addon = Object.assign({}, addon.files.addon, {
      '.fooaddon.js': `fooaddon content`,
      'baraddon.js': `bizbiz content`,
    });

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

  test('dot files are not included as app modules', function(assert) {
    // dot files should exist on disk
    assert.file('.foobar.js').exists();
    assert.file('.barbaz.js').exists();
    assert.file('bizbiz.js').exists();

    // dot files should not be included as modules
    assert.file('assets/my-app.js').doesNotMatch('my-app/.foobar');
    assert.file('assets/my-app.js').doesNotMatch('my-app/.barbaz');
    assert.file('assets/my-app.js').matches('my-app/bizbiz');
  });

  test('dot files are not included as addon implicit-modules', function(assert) {
    // Dot files should exist on disk
    assert.file('node_modules/my-addon/.fooaddon.js').exists();
    assert.file('node_modules/my-addon/baraddon.js').exists();

    let myAddonPackage = assert.file('node_modules/my-addon/package.json').json();

    // dot files are not included as implicit-modules
    myAddonPackage.get(['ember-addon', 'implicit-modules']).deepEquals(['./baraddon']);
  });
});
