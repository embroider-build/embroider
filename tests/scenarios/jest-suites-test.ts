import QUnit from 'qunit';
import { resolve } from 'path';
import { PreparedApp, Project, Scenarios } from 'scenario-tester';

const { module: Qmodule, test } = QUnit;

// this is the bridge between our older Jest-based node tests and our newer
// scenario-tester powered tests
Scenarios.fromProject(() => new Project('node-tests'))
  .map('node', () => {})
  .forEachScenario(scenario => {
    Qmodule(scenario.name, function () {
      test('run node tests', async function (assert) {
        let app = new PreparedApp(resolve(__dirname, '..', '..'));
        let result = await app.execute('yarn jest --forceExit');
        assert.equal(result.exitCode, 0, result.output);
      });
    });
  });
