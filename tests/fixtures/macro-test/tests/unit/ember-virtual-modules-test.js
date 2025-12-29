import { module, test } from 'qunit';

module('Unit | ember-virtual-modules', function () {
  module('@ember/reactive', function () {
    test('it exists', async function (assert) {
      const { trackedObject } = await import('@ember/reactive/collections');

      const data = trackedObject({ foo: 1 });

      assert.deepEqual(data, { foo: 1 });
    });
  });
});
