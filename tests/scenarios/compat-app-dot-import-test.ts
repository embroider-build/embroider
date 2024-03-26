import type { ExpectFile } from '@embroider/test-support/file-assertions/qunit';
import { expectRewrittenFilesAt } from '@embroider/test-support/file-assertions/qunit';
import { throwOnWarnings } from '@embroider/core';
import type { PreparedApp } from 'scenario-tester';
import { join } from 'path';
import { appScenarios, baseAddon } from './scenarios';
import QUnit from 'qunit';
import { merge } from 'lodash';
const { module: Qmodule, test } = QUnit;

appScenarios
  .map('compat-app-dot-import', app => {
    let addon = baseAddon();
    addon.pkg.name = 'my-addon';
    merge(addon.files, {
      'index.js': `
        module.exports = {
          name: require('./package.json').name,
          included() {
            this._super.included.apply(this, arguments);
            this.import('vendor/some-font.ttf', { destDir: 'fonts' });
            this.import('node_modules/third-party/third-party.js', { outputFile: 'assets/tp.js' });
          }
        };
      `,
      vendor: {
        'some-font.ttf': `some font`,
      },
    });
    addon.addDependency('third-party', '1.2.3').files = {
      'third-party.js': '// third party',
    };
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

      hooks.beforeEach(assert => {
        expectFile = expectRewrittenFilesAt(app.dir, {
          qunit: assert,
        });
      });
      test('destDir puts vendor files into public assets', function () {
        expectFile('./node_modules/.embroider/rewritten-packages/@embroider/synthesized-vendor/package.json')
          .json()
          .get(['ember-addon', 'public-assets', './vendor/some-font.ttf'])
          .equals('fonts/some-font.ttf');
        expectFile(
          './node_modules/.embroider/rewritten-packages/@embroider/synthesized-vendor/vendor/some-font.ttf'
        ).exists();
      });

      test('handle non-transformed node_module with explicit outputFile', function () {
        expectFile('./node_modules/.embroider/rewritten-packages/@embroider/synthesized-vendor/package.json')
          .json()
          .get([
            'ember-addon',
            'public-assets',
            join(app.dir, 'node_modules', 'my-addon', 'node_modules', 'third-party', 'third-party.js'),
          ])
          .equals('assets/tp.js');
      });
    });
  });
