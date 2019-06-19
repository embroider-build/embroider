import { module, test } from 'qunit';
import { visit, currentURL } from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';

module('Acceptance | smoke tests', function(hooks) {
  setupApplicationTest(hooks);

  test('ensure all scripts in index.html 200', async function(assert) {
    for (let { src } of document.scripts) {
      let { status } = await fetch(src);
      assert.equal(status, 200, `expected: '${src}' to be accessible`);
    }
  });

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

  test('/ordered.js is ordered correctly', function(assert) {
    assert.deepEqual(self.ORDER, ['FOUR', 'TWO', 'THREE', 'ONE']);
  });
});
