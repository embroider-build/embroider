/* eslint-env node */

const { module: Qmodule, test } = require('qunit');
const setup = require('./util');

Qmodule('fastboot basics', function(hooks) {
  setup(hooks);

  test('hello', async function(assert) {
    assert.expect(2);
    let doc = await this.visit('/');
    assert.equal(doc.querySelector('[data-test="hello"]').textContent, 'Hello from fastboot-app');
  });
});
