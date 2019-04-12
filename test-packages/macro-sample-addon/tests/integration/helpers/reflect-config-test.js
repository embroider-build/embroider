import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';
import { helper } from '@ember/component/helper';

module('Integration | Helper | reflect-config', function(hooks) {
  setupRenderingTest(hooks);

  test('it accesses our config', async function(assert) {
    assert.expect(1);
    this.owner.register(
      'helper:my-assertion',
      helper(function([value]) {
        assert.deepEqual(value, { hello: 'world' });
      })
    );
    await render(hbs`{{my-assertion (reflect-config) }}`);
  });
});
