/* eslint-env node */

const { module: Qmodule, test } = require('qunit');
const setup = require('./util');

Qmodule('fastboot basics', function (hooks) {
  setup(hooks);

  test('host-app', async function (assert) {
    let doc = await this.visit('/');
    assert.equal(doc.querySelector('[data-test-duplicated-helper]').textContent.trim(), 'from-engines-host-app');
  });

  test('lazy-engine', async function (assert) {
    let doc = await this.visit('/use-lazy-engine');
    assert.equal(doc.querySelector('[data-test-lazy-engine-main] > h1').textContent.trim(), 'Lazy engine');
    assert.equal(doc.querySelector('[data-test-duplicated-helper]').textContent.trim(), 'from-lazy-engine');
    assert.equal(doc.querySelector('[data-test-engine-component]').textContent.trim(), 'Engine Component - From Lazy Engine');
  });

  test('eager-engine', async function (assert) {
    let doc = await this.visit('/use-eager-engine');
    assert.equal(doc.querySelector('[data-test-eager-engine-main] > h1').textContent.trim(), 'Eager engine');
    assert.equal(doc.querySelector('[data-test-duplicated-helper]').textContent.trim(), 'from-eager-engine-helper');
  });
});
