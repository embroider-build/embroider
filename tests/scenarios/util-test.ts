import { lts_3_28 } from './scenarios';
import type { PreparedApp } from 'scenario-tester';
import { Scenarios } from 'scenario-tester';
import QUnit from 'qunit';
import { dirname } from 'path';

const { module: Qmodule, test } = QUnit;

Scenarios.fromDir(dirname(require.resolve('@embroider/util/package.json')))
  .expand({
    lts_3_28,
  })
  .map('util', project => {
    // the oldest ember-data we're able to test does not work on the old node
    // we're trying to verify here
    project.removeDependency('ember-data');
    project.mergeFiles({
      '.npmrc': 'use-node-version=12.22.1',
      'test.js': `
        const { module: QModule, test } = require("qunit");
        const semver = require("semver");
        QModule("shared-internals", function () {
          test("testing on node 12", function (assert) {
            assert.ok(
              semver.satisfies(process.version, "^12.0.0"),
              \`\${process.version} should be what we expected\`
            );
          });
        });
      `,
    });
  })
  .forEachScenario(scenario => {
    Qmodule(scenario.name, function (hooks) {
      let app: PreparedApp;
      hooks.before(async () => {
        app = await scenario.prepare();
      });

      test('verify node version', async function (assert) {
        let result = await app.execute(`pnpm ./node_modules/qunit/bin/qunit.js ./test.js`);
        assert.equal(result.exitCode, 0, result.output);
      });

      test(`pnpm test:ember`, async function (assert) {
        let result = await app.execute('pnpm test:ember');
        assert.equal(result.exitCode, 0, result.output);
      });

      test(`pnpm test:classic`, async function (assert) {
        let result = await app.execute('pnpm test:classic');
        assert.equal(result.exitCode, 0, result.output);
      });
    });
  });
