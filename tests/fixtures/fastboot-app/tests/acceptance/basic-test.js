import { module, test } from 'qunit';
import { visit, waitUntil } from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';
import secondSampleLib from '@embroider/second-sample-lib';

module('Acceptance | runtime basics', function (hooks) {
  setupApplicationTest(hooks);

  hooks.beforeEach(async function () {
    await visit('/');
    await waitUntil(() => window.lazyComponentDone);
  });

  test('content is rendered', function (assert) {
    assert.dom('[data-test="hello"]').containsText('Hello from fastboot-app');
  });

  test('found browser implementation of in-app module', function (assert) {
    assert.dom('[data-test="example"]').containsText('This is the browser implementation');
  });

  test('found browser implementation of addon service', function (assert) {
    assert.dom('[data-test="addon-example"]').containsText('Browser AddonExampleService');
  });

  test('found no fastboot-only service from the app', function (assert) {
    assert.dom('[data-test="check-service"]').containsText('No service present');
  });

  test('found no fastboot-only file from the addon', function (assert) {
    assert.dom('[data-test="check-addon-file"]').containsText('No addon file value');
  });

  test('a component lazily loaded some code', async function (assert) {
    assert.dom('[data-test="lazy-component"]').containsText('From sample-lib');
    assert.dom('[data-test="lazy-component-second"]').containsText('From second-sample-lib');
  });

  test('the tests suite eagerly loads some code that the app uses only lazily', async function (assert) {
    assert.equal(secondSampleLib(), 'From second-sample-lib');
  });

  test('a component from a v2 addon with css', async function (assert) {
    assert.dom('[data-test-v2-example]').containsText('it worked');
    assert.equal(
      getComputedStyle(document.querySelector('[data-test-v2-example]')).color,
      'rgb(0, 128, 0)',
      'style was applied'
    );
  });
});
