/* eslint-env node */

const { module: Qmodule, test } = require('qunit');
const setup = require('./util');

Qmodule('fastboot basics', function(hooks) {
  setup(hooks, process.env.FASTBOOT_APP_PROD === 'true' ? ['--environment', 'production'] : undefined);

  let doc;

  hooks.before(async function() {
    doc = await this.visit('/');
  });

  test('content is rendered', async function(assert) {
    assert.equal(doc.querySelector('[data-test="hello"]').textContent, 'Hello from fastboot-app');
  });
  test('found server implementation of in-app module', async function(assert) {
    assert.equal(doc.querySelector('[data-test="example"]').textContent, 'This is the server implementation');
  });
  test('found server implementation of addon service', async function(assert) {
    assert.equal(doc.querySelector('[data-test="addon-example"]').textContent, 'Server AddonExampleService');
  });
  test('found fastboot-only service from the app', async function(assert) {
    assert.equal(
      doc.querySelector('[data-test="check-service"]').textContent.trim(),
      `I'm a fastboot-only service in the app`
    );
  });
  test('found fastboot-only file from the addon', async function(assert) {
    assert.equal(doc.querySelector('[data-test="check-addon-file"]').textContent.trim(), '42');
  });
  test('a component successfully lazy loaded some code', async function(assert) {
    assert.equal(doc.querySelector('[data-test="lazy-component"]').textContent.trim(), 'From sample-lib');
  });
});
