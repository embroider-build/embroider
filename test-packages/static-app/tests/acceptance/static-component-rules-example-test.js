import { module, test } from 'qunit';
import { visit, currentURL } from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';

module('Acceptance | static component rules example', function(hooks) {
  setupApplicationTest(hooks);

  test('visiting /static-component-rules-example', async function(assert) {
    await visit('/static-component-rules-example');
    assert.equal(currentURL(), '/static-component-rules-example');
    assert.ok(document.querySelector('[data-example="default"] .the-default-title-component'), 'default exists');
    assert.ok(document.querySelector('[data-example="customized"] .my-title-component'), 'customized exists');
  });
});
