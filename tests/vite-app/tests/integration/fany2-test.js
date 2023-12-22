import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render, rerender } from '@ember/test-helpers';
import { hbs } from 'ember-cli-htmlbars';

module('Integration | Component | Fany2', (hooks) => {
  setupRenderingTest(hooks);

  test('should have Yay for gjs!', async function (assert) {
    await render(hbs`
    <Fancy @type="primary2"></Fancy>
    <Fancy2 @type="primary2"></Fancy2>
    `);
    await rerender();

    assert.dom().includesText('Yay for gts!');
    assert.dom().includesText('Yay for gjs!');
  });
});
