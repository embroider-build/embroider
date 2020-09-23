import { module, test } from 'qunit';
import { importSync } from '@embroider/macros';

module('Unit | missing-imports', function() {
  test('it works', function(assert) {
    assert.expect(1);

    assert.throws(() => {
      importSync('missingModule');
    }, /Error: Could not find module `missingModule`/);
  });
});
