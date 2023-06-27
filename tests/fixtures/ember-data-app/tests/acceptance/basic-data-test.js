import { module, test } from 'qunit';
import { visit, currentURL } from '@ember/test-helpers';
import { setupApplicationTest } from 'app-template/tests/helpers';

module('Acceptance | basic data', function (hooks) {
  setupApplicationTest(hooks);

  test('visiting /basic-data', async function (assert) {
    await visit('/basic-data');

    assert.strictEqual(currentURL(), '/basic-data');
    assert.dom('[data-test-face="0"]').exists({ count: 1 });
  });
});
