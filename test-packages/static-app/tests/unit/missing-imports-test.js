import { module, test } from 'qunit';
import { importSync } from '@embroider/macros';

module('Unit | missing-imports', function() {
  test('it works', async function(assert) {
    assert.expect(2);

    assert.throws(() => {
      importSync('missingModule');
    }, /missing module/);

    // assert.throws(async () => {
    //   await import('missingModule');
    // }, /missing module/);
  });
});
