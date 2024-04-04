import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render } from '@ember/test-helpers';
import { precompileTemplate } from '@ember/template-compilation';

module('Integration | Helper | reflect-updated-config | contentFor | config-module', function (hooks) {
  setupRenderingTest(hooks);

  test('it accesses our config', async function (assert) {
    assert.expect(1);
    function myAssertion(value) {
      assert.deepEqual(value, 'hello new world');
    }
    await render(precompileTemplate(`{{myAssertion (reflect-updated-config) }}`, {
      scope: () => ({ myAssertion })
    }));
  });
});