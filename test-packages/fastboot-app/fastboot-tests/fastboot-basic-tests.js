/* eslint-env node */

const { module: Qmodule, test } = require('qunit');
const setup = require('./util');

Qmodule('fastboot basics', function(hooks) {
  setup(hooks);

  test('hello', async function(assert) {
    let doc = await this.visit('/');
    assert.equal(doc.querySelector('[data-test="hello"]').textContent, 'Hello from fastboot-app');
    assert.equal(doc.querySelector('[data-test="example"]').textContent, 'This is the server implementation');
    assert.equal(doc.querySelector('[data-test="addon-example"]').textContent, 'Server AddonExampleService');
    assert.equal(
      doc.querySelector('[data-test="check-service"]').textContent.trim(),
      `I'm a fastboot-only service in the app`
    );
  });
});
