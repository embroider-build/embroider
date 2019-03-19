import { module, test } from 'qunit';
import { visit, currentURL } from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';

module('Acceptance | smoke tests', function(hooks) {
  setupApplicationTest(hooks);

  test('JS getOwnConfig worked', async function(assert) {
    await visit('/');
    assert.equal(currentURL(), '/');
    assert.equal(this.element.querySelector('[data-test-mode]').textContent.trim(), 'amazing');
  });

  test('HBS getOwnConfig worked', async function(assert) {
    await visit('/');
    assert.equal(currentURL(), '/');
    assert.equal(this.element.querySelector('[data-test-count]').textContent.trim(), '42');
  });

  test('Addon classic component renders', async function(assert) {
    await visit('/');
    assert.equal(currentURL(), '/');

    assert.dom('[data-test-classic-component]').isVisible({count: 1});
  });

  test('Addon pod component renders', async function(assert) {
    await visit('/');
    assert.equal(currentURL(), '/');

    assert.dom('[data-test-pod-component]').isVisible({count: 1});
  });
});
