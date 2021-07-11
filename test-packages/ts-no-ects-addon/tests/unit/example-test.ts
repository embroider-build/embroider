import { module, test } from 'qunit';

interface Args {
  example: string;
}

module('Example Module', function () {
  test('Example Test', function (assert) {
    let value: Args = { example: 'example' };
    assert.ok(
      value,
      'This test file should be transpiled by embroider, even without ember-cli-typescript'
    );
  });
});
