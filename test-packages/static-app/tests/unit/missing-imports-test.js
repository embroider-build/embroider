import { module, test } from 'qunit';
import { importSync } from '@embroider/macros';

module('Unit | missing modules referenced by importSync', function() {
  test('it works', function(assert) {
    assert.expect(2);

    assert.throws(() => {
      importSync('bar');
    }, /Error: Could not find module `bar`/);

    assert.throws(() => {
      importSync('baz');
    }, /Error: Could not find module `baz`/);
  });
});
