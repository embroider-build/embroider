import { supportMatrix } from './scenarios';
import { PreparedApp, Scenarios } from 'scenario-tester';
import QUnit from 'qunit';
import { dirname } from 'path';

const { module: Qmodule, test } = QUnit;

supportMatrix(Scenarios.fromDir(dirname(require.resolve('@embroider/router/package.json'))))
  .map('router', () => {})
  .forEachScenario(scenario => {
    Qmodule(scenario.name, function (hooks) {
      let app: PreparedApp;
      hooks.before(async () => {
        app = await scenario.prepare();
      });
      test(`yarn test:ember`, async function (assert) {
        let result = await app.execute('yarn test:ember');
        assert.equal(result.exitCode, 0, result.output);
      });
    });
  });
