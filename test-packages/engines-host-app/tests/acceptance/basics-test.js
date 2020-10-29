import { module, test } from 'qunit';
import { visit, currentURL } from '@ember/test-helpers';
import { setupApplicationTest, skip } from 'ember-qunit';

module('Acceptance | basics', function (hooks) {
  setupApplicationTest(hooks);

  test('host-app', async function (assert) {
    await visit('/');
    assert.equal(currentURL(), '/');
    assert.dom('[data-test-duplicated-helper]').containsText('from-engines-host-app');
  });

  // this test must be the first test that loads the use-lazy-engine engine
  // as after it has loaded it will not "unload" and we are checking that these
  // modules are entering require.entries for the first time.
  test('lazy-engine', async function (assert) {
    await visit('/');
    let entriesBefore = Object.entries(window.require.entries).length;

    await visit('/style-check');
    assert.dom('.shared-style-target').exists();

    assert.equal(
      getComputedStyle(document.querySelector('.shared-style-target'))['border-left-width'],
      '2px',
      'eager-engine styles are present'
    );

    assert.equal(
      getComputedStyle(document.querySelector('.shared-style-target'))['border-right-width'],
      '0px',
      'lazy-engine addon styles are not present'
    );

    assert.equal(
      getComputedStyle(document.querySelector('.shared-style-target'))['border-top-width'],
      '0px',
      'lazy-engine vendor styles are not present'
    );

    // TODO: uncomment once we fix this appearing too eagerly
    //assert.notOk(!!window.require.entries['lazy-engine/helpers/duplicated-helper']);

    await visit('/use-lazy-engine');
    let entriesAfter = Object.entries(window.require.entries).length;
    assert.ok(!!window.require.entries['lazy-engine/helpers/duplicated-helper']);
    assert.ok(entriesAfter > entriesBefore);
    assert.equal(currentURL(), '/use-lazy-engine');
    assert.dom('[data-test-lazy-engine-main] > h1').containsText('Lazy engine');
    assert.dom('[data-test-duplicated-helper]').containsText('from-lazy-engine');

    await visit('/style-check');

    assert.equal(
      getComputedStyle(document.querySelector('.shared-style-target'))['border-left-width'],
      '2px',
      'eager-engine styles are still present'
    );

    assert.equal(
      getComputedStyle(document.querySelector('.shared-style-target'))['border-right-width'],
      '2px',
      'now lazy-engine styles are present'
    );

    assert.equal(
      getComputedStyle(document.querySelector('.shared-style-target'))['border-top-width'],
      '2px',
      'lazy-engine vendor styles are present'
    );
  });

  // See TODO comment in above test
  skip('lazy engines own app tree is lazy', function () {});

  test('eager-engine', async function (assert) {
    await visit('/use-eager-engine');
    assert.equal(currentURL(), '/use-eager-engine');
    assert.dom('[data-test-eager-engine-main] > h1').containsText('Eager engine');
    assert.dom('[data-test-truth-helpers-ok]').exists();
    assert.dom('[data-test-duplicated-helper]').containsText('from-eager-engine-helper');
  });
});
