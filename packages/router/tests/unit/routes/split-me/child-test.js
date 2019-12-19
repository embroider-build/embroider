import { module, test } from 'qunit';
import { setupTest } from 'ember-qunit';

module('Unit | Route | split-me/child', function(hooks) {
  setupTest(hooks);

  test('it exists', function(assert) {
    let route = this.owner.lookup('route:split-me/child');
    assert.ok(route);
  });
});
