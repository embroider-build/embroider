import type { ExpectFile } from '@embroider/test-support/file-assertions/qunit';
import { expectRewrittenFilesAt } from '@embroider/test-support/file-assertions/qunit';
import { throwOnWarnings } from '@embroider/core';
import type { PreparedApp } from 'scenario-tester';
import { appScenarios, baseAddon } from './scenarios';
import QUnit from 'qunit';
import { merge } from 'lodash';
import { setupAuditTest } from '@embroider/test-support/audit-assertions';
const { module: Qmodule, test } = QUnit;

appScenarios
  .map('compat-exclude-dot-files', app => {
    merge(app.files, {
      'ember-cli-build.js': `'use strict';

      const EmberApp = require('ember-cli/lib/broccoli/ember-app');
      const { maybeEmbroider } = require('@embroider/test-setup');

      module.exports = function (defaults) {
        let app = new EmberApp(defaults, {});

        return maybeEmbroider(app, {
          staticAddonTrees: false,
          skipBabel: [
            {
              package: 'qunit',
            },
          ],
        });
      };
      `,
      app: {
        '.foobar.js': `// foobar content`,
        '.barbaz.js': `// barbaz content`,
        'bizbiz.js': `// bizbiz content`,
      },
    });

    let addon = baseAddon();
    addon.pkg.name = 'my-addon';
    merge(addon.files, {
      addon: {
        '.fooaddon.js': `// fooaddon content`,
        'baraddon.js': `// bizbiz content`,
      },
    });
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
        expectFile = expectRewrittenFilesAt(app.dir, { qunit: assert });
      });

      test('dot files are not included as app modules', function (assert) {
        // dot files should exist on disk
        expectFile('./.foobar.js').exists();
        expectFile('./.barbaz.js').exists();
        expectFile('./bizbiz.js').exists();

        // but not be picked up in the entrypoint
        expectAudit
          .module('./node_modules/.embroider/rewritten-app/index.html')
          .resolves('./assets/app-template.js')
          .toModule()
          .withContents(content => {
            assert.notOk(/app-template\/\.foobar/.test(content), '.foobar is not in the entrypoint');
            assert.notOk(/app-template\/\.barbaz/.test(content), '.barbaz is not in the entrypoint');
            assert.ok(/app-template\/bizbiz/.test(content), 'bizbiz is in the entrypoint');

            // we are relying on the assertinos here so we always return true
            return true;
          });
      });

      test('dot files are not included as addon implicit-modules', function () {
        // Dot files should exist on disk
        expectFile('./node_modules/my-addon/.fooaddon.js').exists();
        expectFile('./node_modules/my-addon/baraddon.js').exists();

        let myAddonPackage = expectFile('./node_modules/my-addon/package.json').json();

        // dot files are not included as implicit-modules
        myAddonPackage.get(['ember-addon', 'implicit-modules']).deepEquals(['./baraddon']);
      });
    });
  });
