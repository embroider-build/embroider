import { module, test } from 'qunit';
import appEmberSat from 'macro-sample-addon/app-ember-satisfies';

module('Unit | appEmberSatisfies', function() {
  test('addon code can use appEmberSatisfies', function(assert) {
    assert.strictEqual(appEmberSat().aboveTwo, true);
    assert.strictEqual(appEmberSat().belowTwo, false);
  })
});
