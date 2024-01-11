import type { PreparedApp } from 'scenario-tester';
import { appScenarios, baseAddon, renameApp } from './scenarios';
import { readFileSync } from 'fs';
import { join } from 'path';
import QUnit from 'qunit';
const { module: Qmodule, test } = QUnit;
import type { ExpectFile } from '@embroider/test-support/file-assertions/qunit';
import { expectFilesAt } from '@embroider/test-support/file-assertions/qunit';
import { throwOnWarnings } from '@embroider/core';
import { setupAuditTest } from '@embroider/test-support/audit-assertions';
import merge from 'lodash/merge';

appScenarios
  .map('compat-namespaced-app', app => {
    renameApp(app, '@ef4/namespaced-app');

    merge(app.files, {
      app: {
        components: {
          'import-lodash.js': `
          import lodash from "lodash";
          `,
        },
      },
    });

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

      let expectAudit = setupAuditTest(hooks, () => ({ app: app.dir }));

      hooks.beforeEach(assert => {
        expectFile = expectFilesAt(readFileSync(join(app.dir, 'dist/.stage2-output'), 'utf8'), { qunit: assert });
      });
      test(`app js location`, function () {
        expectFile('assets/@ef4/namespaced-app.js').exists();
      });

      test(`imports within app js`, function () {
        expectAudit
          .module('assets/@ef4/namespaced-app.js')
          .resolves('./-embroider-implicit-modules.js')
          .toModule()
          .resolves('my-addon/my-implicit-module.js')
          .to('./node_modules/my-addon/my-implicit-module.js');

        expectAudit
          .module('assets/@ef4/namespaced-app.js')
          .resolves('./-embroider-amd-modules.js')
          .to('./node_modules/.embroider/rewritten-app/-embroider-amd-modules.js');

        expectAudit
          .module('assets/@ef4/namespaced-app.js')
          .resolves('./-embroider-amd-modules.js')
          .toModule()
          .withContents(contents => {
            const [, objectName] = /"@ef4\/namespaced-app\/app": (amdMod\d+),/.exec(contents) ?? [];

            return contents.includes(`import * as ${objectName} from "@ef4\/namespaced-app\/app.js";`);
          }, 'app.js import/export should be present in the virtual -embroider-amd-modules.js file');
      });

      test(`app css location`, function () {
        expectFile('assets/@ef4/namespaced-app.css').exists();
      });
    });
  });
