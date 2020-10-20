import { module, test } from 'qunit';
import { setup, visit } from 'ember-cli-fastboot-testing/test-support';
import config from 'fastboot-app/config/environment';

// Running the app in FastBoot in a classic build fails for some reasons related to ember-auto-import/webpack/dynamic import
// with webpack trying to use `document` which is undefined. But as we are only interested in Embroider working correctly here,
// we can skip classic tests here.
if (config.buildType === 'embroider') {
  module('FastBoot | basic', async function (hooks) {
    setup(hooks);

    test('content is rendered', async function (assert) {
      await visit('/');
      assert.dom('[data-test="hello"]').containsText('Hello from fastboot-app');
    });

    test('found browser implementation of in-app module', async function (assert) {
      await visit('/');
      assert.dom('[data-test="example"]').containsText('This is the server implementation');
    });

    test('found browser implementation of addon service', async function (assert) {
      await visit('/');
      assert.dom('[data-test="addon-example"]').containsText('Server AddonExampleService');
    });

    test('found no fastboot-only service from the app', async function (assert) {
      await visit('/');
      assert.dom('[data-test="check-service"]').containsText("I'm a fastboot-only service in the app");
    });

    test('found no fastboot-only file from the addon', async function (assert) {
      await visit('/');
      assert.dom('[data-test="check-addon-file"]').containsText('42');
    });

    test('a component lazily loaded some code', async function (assert) {
      await visit('/');
      assert.dom('[data-test="lazy-component"]').containsText('From sample-lib');
    });
  });
}
