import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render, rerender } from '@ember/test-helpers';
import Fancy from 'vite-app/components/fancy';


module('Integration | Component | Fany -- from gts test file', (hooks) => {
  setupRenderingTest(hooks);

  test('should have Yay for gts!', async function(assert) {
    await render(<template>
  <Fancy @type="primary2"></Fancy>
</template>);
    await rerender()

    assert.dom().hasText('Yay for gts!');
  });
});




