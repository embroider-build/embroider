import type { ExpectFile } from '@embroider/test-support/file-assertions/qunit';
import { expectFilesAt } from '@embroider/test-support/file-assertions/qunit';
import { throwOnWarnings } from '@embroider/core';
import type { PreparedApp } from 'scenario-tester';
import { appScenarios } from './scenarios';
import { readFileSync } from 'fs';
import { join } from 'path';
import QUnit from 'qunit';
const { module: Qmodule, test } = QUnit;

export function samplePlugin() {
  return { visitor: {} };
}

appScenarios
  .map('compat-plugin-hints', app => {
    app.files['ember-cli-build.js'] = `
      'use strict';

      'use strict';

        const EmberApp = require('ember-cli/lib/broccoli/ember-app');

        // TODO make prebuild so that we don't need to copy across the big chunk of code e.g. app-config-environment-test.ts
        const { prebuild } = require('@embroider/compat');

        module.exports = function (defaults) {
          const app = new EmberApp(defaults, {
            babel: {
              plugins: [
                // deliberately non-serializable form
                require("${__filename.replace(/\\/g, '/').replace(/\.ts$/, '.js')}").samplePlugin
              ]
            }
          });

          return prebuild(app, {
            // TODO this goes away when we fix the explicit babel config to be more sensible
            skipBabel: [
              {
                package: 'qunit',
              },
            ],
            pluginHints: [
              {
                resolve: ["${__filename.replace(/\\/g, '/').replace(/\.ts$/, '.js')}"],
                useMethod: 'samplePlugin',
              },
            ],
          });
        };
      `;
  })
  .forEachScenario(scenario => {
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

      test('is parallel safe', function () {
        expectFile('./package.json').json().get('ember-addon.babel.isParallelSafe').equals(true);
      });
    });
  });
