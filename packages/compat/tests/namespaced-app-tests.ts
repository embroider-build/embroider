import 'qunit';
import { Project, BuildResult, installFileAssertions } from '@embroider/test-support';
import { throwOnWarnings } from '@embroider/core';

QUnit.module('namespaced app', function(origHooks) {
  let { hooks, test } = installFileAssertions(origHooks);
  let build: BuildResult;

  throwOnWarnings(hooks);

  hooks.before(async function(assert) {
    let app = Project.emberNew('@ef4/namespaced-app');
    let addon = app.addAddon('my-addon');
    addon.files['my-implicit-module.js'] = '';
    addon.pkg['ember-addon'] = {
      version: 2,
      type: 'addon',
      'implicit-modules': ['./my-implicit-module.js'],
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

  test(`app js location`, function(assert) {
    assert.file('assets/@ef4/namespaced-app.js').exists();
  });

  test(`imports within app js`, function(assert) {
    let assertFile = assert.file('assets/@ef4/namespaced-app.js');
    assertFile.matches(
      /d\(["'"]my-addon\/my-implicit-module["'], function\(\)\{ return i\(["']\.\.\/\.\.\/node_modules\/my-addon\/my-implicit-module\.js["']\);/,
      'implicit-modules have correct paths'
    );
    assertFile.matches(
      /d\(["']@ef4\/namespaced-app\/app['"], function\(\)\{ return i\(['"]\.\.\/\.\.\/app"\);\}\);/,
      `app's own modules are correct`
    );
  });

  test(`app css location`, function(assert) {
    assert.file('assets/@ef4/namespaced-app.css').exists();
  });
});
