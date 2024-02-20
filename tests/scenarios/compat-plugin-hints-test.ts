import type { ExpectFile } from '@embroider/test-support/file-assertions/qunit';
import { expectFilesAt } from '@embroider/test-support/file-assertions/qunit';
import { throwOnWarnings } from '@embroider/core';
import type { PreparedApp } from 'scenario-tester';
import { appScenarios } from './scenarios';
import { readFileSync } from 'fs';
import { join } from 'path';
import QUnit from 'qunit';
const { module: Qmodule, test } = QUnit;

appScenarios
  .map('compat-plugin-hints', app => {
    app.files['sample-plugin.js'] = `module.exports.samplePlugin = function samplePlugin() {
      return { visitor: {} };
    }`;

    app.files['ember-cli-build.js'] = `
      'use strict';

      const EmberApp = require('ember-cli/lib/broccoli/ember-app');
      const { maybeEmbroider } = require('@embroider/test-setup');
      const path = require('path');

      module.exports = function (defaults) {

        debugger
        let app = new EmberApp(defaults, {
          babel: {
            plugins: [
              // deliberately non-serializable form
              require(path.join(__dirname, 'sample-plugin.js')).samplePlugin
            ]
          }
        });

        return maybeEmbroider(app, {
          skipBabel: [
            {
              package: 'qunit',
            },
          ],
          pluginHints: [
            {
              resolve: [path.join(__dirname, 'sample-plugin.js')],
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
