import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render, click, rerender, settled } from '@ember/test-helpers';
import Fancy from 'vite-app/components/fancy';


module('Integration | Component | Fany', (hooks) => {
  setupRenderingTest(hooks);

  test('should have Yay for gjs!', async function(assert) {
    await render(<template>
  <Fancy @type="primary2"></Fancy>
</template>);
    await rerender()

    assert.dom().hasText('Yay for gts!');
  });
});




