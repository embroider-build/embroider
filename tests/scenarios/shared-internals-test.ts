import QUnit from 'qunit';
import { Project, Scenarios } from 'scenario-tester';

const { module: Qmodule, test } = QUnit;

Scenarios.fromProject(() => new Project('shared-internals-tests'))
  .map('shared-internals', project => {
    project.pkg.volta = {
      node: '12.22.1',
    };
    project.linkDependency('@embroider/shared-internals', { baseDir: __dirname });
    project.linkDependency('qunit', { baseDir: __dirname });
    project.linkDependency('semver', { baseDir: __dirname });

    project.mergeFiles({
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

        // if we just try to invoke node directly in a child process, our own
        // volta settings dominate over the test app's
        let tryit = await app.execute('volta which node');
        if (tryit.exitCode !== 0) {
          throw new Error('unable to locate our node version');
        }
        let nodebin = tryit.output.trim();
        let result = await app.execute(`${nodebin} ./node_modules/qunit/bin/qunit.js ./test.js`);
        assert.equal(result.exitCode, 0, result.output);
      });
    });
  });
