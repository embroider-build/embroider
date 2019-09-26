import { module, test } from 'qunit';
import { setup, visit } from 'ember-cli-fastboot-testing/test-support';

module('FastBoot | home-page test', function (hooks) {
  setup(hooks);

  test('JS fastboot imports with funky-addon moduleName', async function (assert) {
    await visit('/');
    // replace this line with a real assertion!
    assert.ok(true);
  });
});