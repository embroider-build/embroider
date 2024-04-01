import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render } from '@ember/test-helpers';
import { precompileTemplate } from '@ember/template-compilation';

module('Integration | Helper | reflect-config', function (hooks) {
  setupRenderingTest(hooks);

  test('it accesses our config', async function (assert) {
    assert.expect(1);
    function myAssertion(value) {
      assert.deepEqual(value, { hello: 'world' });
    }
    await render(precompileTemplate(`{{myAssertion (reflect-config) }}`, {
      scope: () => ({ myAssertion })
    }));
  });
});
