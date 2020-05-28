import { module, test } from 'qunit';
import {
  visit,
  setupApplicationContext,
  teardownApplicationContext,
  setupContext,
  teardownContext,
  waitUntil,
} from '@ember/test-helpers';

module('Acceptance | runtime basics', function(hooks) {
  let opts = { waitForSettled: true };

  hooks.before(async function() {
    await setupContext(this, opts);
    await setupApplicationContext(this);
    await visit('/');
    await waitUntil(() => window.lazyComponentDone);
  });

  hooks.after(async function() {
    await teardownApplicationContext(this, opts);
    await teardownContext(this, opts);
  });

  test('content is rendered', function(assert) {
    assert.dom('[data-test="hello"]').containsText('Hello from fastboot-app');
  });

  test('found browser implementation of in-app module', function(assert) {
    assert.dom('[data-test="example"]').containsText('This is the browser implementation');
  });

  test('found browser implementation of addon service', function(assert) {
    assert.dom('[data-test="addon-example"]').containsText('Browser AddonExampleService');
  });

  test('found no fastboot-only service from the app', function(assert) {
    assert.dom('[data-test="check-service"]').containsText('No service present');
  });

  test('found no fastboot-only file from the addon', function(assert) {
    assert.dom('[data-test="check-addon-file"]').containsText('No addon file value');
  });

  test('a component lazily loaded some code', async function(assert) {
    assert.dom('[data-test="lazy-component"]').containsText('From sample-lib');
  });
});
