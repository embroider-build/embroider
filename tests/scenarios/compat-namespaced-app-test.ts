import type { PreparedApp } from 'scenario-tester';
import { appScenarios, baseAddon, renameApp } from './scenarios';
import QUnit from 'qunit';
const { module: Qmodule, test } = QUnit;
import type { ExpectFile } from '@embroider/test-support/file-assertions/qunit';
import { expectRewrittenFilesAt } from '@embroider/test-support/file-assertions/qunit';
import { throwOnWarnings } from '@embroider/core';
import { setupAuditTest } from '@embroider/test-support/audit-assertions';

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
        let result = await app.execute('ember build', { env: { EMBROIDER_PREBUILD: 'true' } });
        assert.equal(result.exitCode, 0, result.output);
      });

      let expectAudit = setupAuditTest(hooks, () => ({ app: app.dir }));

      hooks.beforeEach(assert => {
        expectFile = expectRewrittenFilesAt(app.dir, { qunit: assert });
      });

      test(`imports within app js`, function () {
        expectAudit
          .module('./node_modules/.embroider/rewritten-app/index.html')
          .resolves('./assets/@ef4/namespaced-app.js')
          .toModule()
          .resolves('./-embroider-implicit-modules.js')
          .toModule()
          .resolves('my-addon/my-implicit-module.js')
          .to('./node_modules/my-addon/my-implicit-module.js');

        expectAudit
          .module('./node_modules/.embroider/rewritten-app/index.html')
          .resolves('./assets/@ef4/namespaced-app.js')
          .toModule().codeContains(`d("@ef4/namespaced-app/templates/application", function () {
            return i("@ef4/namespaced-app/templates/application.hbs");
          });`);
      });

      test(`app css location`, function () {
        expectFile('assets/@ef4/namespaced-app.css').exists();
      });
    });
  });
