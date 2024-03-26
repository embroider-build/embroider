import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render, rerender } from '@ember/test-helpers';
import { hbs } from 'ember-cli-htmlbars';

module('Integration | Component | Example', (hooks) => {
  setupRenderingTest(hooks);

  test('should have Yay for gts!', async function (assert) {
    await render(hbs`
    <Example></Example>
    `);
    await rerender();
    assert.dom().includesText('Yay for gts!');
  });
});
