import { module, test } from 'qunit';
import { visit, currentURL } from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';

module('Acceptance | Routing Works', function(hooks) {
  setupApplicationTest(hooks);

  test('that we can route to the engine', async function(assert) {
    await visit('/eager-engine');
    assert.equal(currentURL(), '/eager-engine');
  });
});
