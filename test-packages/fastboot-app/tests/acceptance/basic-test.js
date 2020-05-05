import { module, test } from 'qunit';
import { visit, currentURL } from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';

module('Acceptance | runtime basics', function(hooks) {
  setupApplicationTest(hooks);
  test('visiting /', async function(assert) {
    await visit('/');
    assert.equal(currentURL(), '/');
    assert.dom('[data-test="hello"]').containsText('Hello from fastboot-app');
    assert.dom('[data-test="example"]').containsText('This is the browser implementation');
  });
});
