import QUnit from 'qunit';
import { Project, Scenarios } from 'scenario-tester';

const { module: Qmodule, test } = QUnit;

Scenarios.fromProject(() => new Project('shared-internals-tests'))
  .map('shared-internals', project => {
    project.linkDependency('@embroider/shared-internals', { baseDir: __dirname });
    project.linkDependency('qunit', { baseDir: __dirname });
    project.linkDependency('semver', { baseDir: __dirname });

    project.mergeFiles({
      '.npmrc': 'use-node-version=12.22.1',
      'test.js': `
        const { module: QModule, test } = require("qunit");
        const semver = require("semver");
        const { PackageCache } = require("@embroider/shared-internals");

        QModule("shared-internals", function () {
          test("testing on node 12", function (assert) {
            assert.ok(
              semver.satisfies(process.version, "^12.0.0"),
              \`\${process.version} should be what we expected\`
            );
          });

          test("smoke test", async function (assert) {
            let pk = PackageCache.shared("my-test", __dirname);
            assert.equal(pk.get(__dirname).name, "shared-internals-tests");
          });
        });
      `,
    });
  })
  .forEachScenario(scenario => {
    Qmodule(scenario.name, function () {
      test('run tests', async function (assert) {
        let app = await scenario.prepare();

        let result = await app.execute(`pnpm ./node_modules/qunit/bin/qunit.js ./test.js`);
        assert.equal(result.exitCode, 0, result.output);
      });
    });
  });
