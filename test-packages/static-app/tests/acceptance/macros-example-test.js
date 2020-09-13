import { module, test } from 'qunit';
import { visit } from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';
import { getOwnConfig } from '@embroider/macros';

module('Acceptance | macros-example', function(hooks) {
  setupApplicationTest(hooks);

  test('macros work', async function(assert) {
    await visit('/macros-example');

    if (getOwnConfig().isClassic) {
      assert.dom('[data-macro]').hasText('Welcome to this classic app!');
    } else {
      assert.dom('[data-macro]').hasText('Welcome to this embroider app!');
    }
  });
});
