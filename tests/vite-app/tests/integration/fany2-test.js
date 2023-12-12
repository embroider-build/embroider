import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render, click, rerender, settled } from '@ember/test-helpers';
import Fancy from 'vite-app/components/fancy';
import { hbs } from 'ember-cli-htmlbars';

module('Integration | Component | Fany2', (hooks) => {
  setupRenderingTest(hooks);

  test('should have Yay for gjs!', async function (assert) {
    await render(hbs`
    <Fancy @type="primary2"></Fancy>
    <Fancy2 @type="primary2"></Fancy2>
    `);
    await rerender();

    assert.dom().hasText('Yay for gts! Yay for gjs!');
  });
});
