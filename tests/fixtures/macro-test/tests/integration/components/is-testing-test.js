import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { isTesting } from '@embroider/macros';

module('Integration | Macro | isTesting', function(hooks) {
  setupRenderingTest(hooks);

  test('the test suite itself sees isTesting true', async function(assert) {
    assert.ok(isTesting());
  });
});
