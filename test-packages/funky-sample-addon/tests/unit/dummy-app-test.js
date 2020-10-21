import { module, test } from 'qunit';
import exampleAddonFunction from 'funky-sample-addon';

import FakeOther from 'fake-module';

const {
  foo, bar
} = FakeOther;

module('Unit | funky babel step created module is importable', function() {
  test('that it works correctly', async function(assert) {
    assert.ok(exampleAddonFunction());
    assert.ok(foo.isFoo);
    assert.ok(bar.isBar);
  });
});
