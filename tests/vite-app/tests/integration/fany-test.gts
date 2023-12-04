import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render, click, rerender, settled } from '@ember/test-helpers';
import Fancy from 'vite-app/components/fancy';


module('Integration | Component | Fany', (hooks) => {
  setupRenderingTest(hooks);

  test('should set as primary', async function(assert) {
    await render(<template>
  <Fany @type="primary2"></Fany>
</template>);
    await rerender()

    assert.dom('button').hasClass('cds--btn--primary');
  });
});


