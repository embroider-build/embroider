import add from 'add';
import subtract from 'subtract';

import { module, test } from 'qunit';

module('Unit | Utility | import', function() {
  test('app.import works', function(assert) {
    assert.equal(add.add(2, 2), 4);
    assert.equal(subtract(10, 7), 3);
  });
});
