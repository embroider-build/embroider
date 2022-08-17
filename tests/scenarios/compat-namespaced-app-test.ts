import { PreparedApp } from 'scenario-tester';
import { appScenarios, baseAddon, renameApp } from './scenarios';
import { readFileSync } from 'fs';
import { join } from 'path';
import QUnit from 'qunit';
const { module: Qmodule, test } = QUnit;
import { expectFilesAt, ExpectFile } from '@embroider/test-support';
import { throwOnWarnings } from '@embroider/core';

appScenarios
  .map('compat-namespaced-app', app => {
    renameApp(app, '@ef4/namespaced-app');

    let addon = baseAddon();
    addon.pkg.name = 'my-addon';
    addon.pkg['ember-addon'] = {
      version: 2,
      type: 'addon',
      'implicit-modules': ['./my-implicit-module.js'],
    };
    addon.files['my-implicit-module.js'] = '';
    app.addDevDependency(addon);
  })
  .forEachScenario(function (scenario) {
    Qmodule(scenario.name, function (hooks) {
      throwOnWarnings(hooks);

      let app: PreparedApp;

      let expectFile: ExpectFile;

      hooks.before(async assert => {
        app = await scenario.prepare();
        let result = await app.execute('ember build', { env: { STAGE2_ONLY: 'true' } });
        assert.equal(result.exitCode, 0, result.output);
      });

      hooks.beforeEach(assert => {
        expectFile = expectFilesAt(readFileSync(join(app.dir, 'dist/.stage2-output'), 'utf8'), { qunit: assert });
      });
      test(`app js location`, function () {
        expectFile('assets/@ef4/namespaced-app.js').exists();
      });

      test(`imports within app js`, function () {
        let assertFile = expectFile('assets/@ef4/namespaced-app.js');
        assertFile.matches(
          /d\(["'"]my-addon\/my-implicit-module["'], function\(\)\{ return i\(["']\.\.\/\.\.\/node_modules\/my-addon\/my-implicit-module\.js["']\);/,
          'implicit-modules have correct paths'
        );
        assertFile.matches(
          /d\(["']@ef4\/namespaced-app\/app['"], function\(\)\{ return i\(['"]\.\.\/\.\.\/app\.js"\);\}\);/,
          `app's own modules are correct`
        );
      });

      test(`app css location`, function () {
        expectFile('assets/@ef4/namespaced-app.css').exists();
      });
    });
  });
