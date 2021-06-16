import { module, test } from 'qunit';
import { exampleAddonFunction } from 'dummy/example';

module('Unit | example-addon-function', function() {
  test('our dummy app can resolve a function directly out of our addon', async function(assert) {
    assert.equal(exampleAddonFunction(), 'example-addon-function-output');
  });
});
