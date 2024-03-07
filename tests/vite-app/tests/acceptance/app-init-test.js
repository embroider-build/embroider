import { module, test } from 'qunit';
import { visit } from '@ember/test-helpers';
import { getApplication } from '@ember/test-helpers';
import { setupApplicationTest } from 'vite-app/tests/helpers';

module('Acceptance | app route', function (hooks) {
  setupApplicationTest(hooks);

  test('loaded initializers /', async function (assert) {
    const app = getApplication();
    assert.true([...app._applicationInstances][0].__instance_test_init);
    assert.true(app.__test_init);
  });
});
