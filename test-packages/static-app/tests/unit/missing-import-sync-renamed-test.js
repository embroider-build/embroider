import { module, test } from 'qunit';
import { importSync as i } from '@embroider/macros';

module('Unit | missing modules referenced by i which was renamed from importSync', function() {
  test('it works', function(assert) {
    assert.expect(2);

    assert.throws(() => {
      i('foobar');
    }, /Error: Could not find module `foobar`/);

    assert.throws(() => {
      i('foobaz');
    }, /Error: Could not find module `foobaz`/);
  });
});
