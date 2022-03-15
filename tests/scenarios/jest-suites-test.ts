import QUnit from 'qunit';
import { resolve } from 'path';
import { PreparedApp } from 'scenario-tester';

const { module: Qmodule, test } = QUnit;

// this is the bridge between our older Jest-based node tests and our newer
// scenario-tester powered tests
Qmodule('node', function () {
  test('run node tests', async function (assert) {
    let app = new PreparedApp(resolve(__dirname, '..', '..'));
    let result = await app.execute('yarn jest --forceExit');
    assert.equal(result.exitCode, 0, result.output);
  });
});
