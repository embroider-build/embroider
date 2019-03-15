import { module, test } from 'qunit';
import { visit } from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';

module('Acceptance | helpers', function(hooks) {
  setupApplicationTest(hooks);

  test('static helpers', async function(assert) {
    await visit('/');

    assert.deepEqual(
      [...document.querySelectorAll("[data-word]")].map(elt => elt.dataset.word),
      ['beta', 'alpha'],
      'array and reverse worked'
    );

    let helpers = [...document.querySelectorAll("[data-helper-name]")].map(elt => elt.dataset.helperName);
    assert.ok(helpers.includes('reverse'), 'expected to find reverse');
    assert.ok(!helpers.includes('intersect'), 'expected not to find intersect');

  });
});
