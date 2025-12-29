import { module, test } from 'qunit';

module('Unit | ember-virtual-modules', function () {

  module('@ember/reactive', function () {
    if (appEmberSatisfies('>= 6.8.0-beta.1')) {
      test('it exists', async function (assert) {
        const { trackedObject } = await import('@ember/reactive/collections');

        const data = trackedObject({ foo: 1 });

        assert.deepEqual(data, { foo: 1 });
      });
    } else {
      test('it does not exist', async function (assert) {
        try {
          await import('@ember/reactive/collections');
        } catch (e) {
          if (e.includes('Failed to resolve module specifier')) {
            assert.step('error');
          } else {
            throw e;
          }
        }

        assert.verifySteps(['error']);
      });
    }
  });

});
