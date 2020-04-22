import { module, test } from 'qunit';
import { visit, currentURL } from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';

module('Acceptance | basics', function(hooks) {
  setupApplicationTest(hooks);

  test('host-app', async function(assert) {
    await visit('/');
    assert.equal(currentURL(), '/');
    assert.dom('[data-test-duplicated-helper]').containsText('from-engines-host-app');
  });

  // this test must be the first test that loads the use-lazy-engine engine
  // as after it has loaded it will not "unload" and we are checking that these
  // modules are entering require.entries for the first time.
  test('lazy-engine', async function(assert) {
    await visit('/');
    let entriesBefore = Object.entries(window.require.entries).length;
    assert.notOk(window.require.entries['lazy-engine/_app_/helpers/duplicated-helper']);

    // do the style check before we visit the lazy engine
    await visit('/style-check');
    assert.dom('.shared-style-target').exists();
    assert.equal(
      getComputedStyle(document.querySelector('.shared-style-target'))['border-left-color'],
      'rgb(0, 0, 255)',
      'eager-engine styles are present'
    );

    // verify lazy engine styles are not present
    assert.equal(
      getComputedStyle(document.querySelector('.shared-style-target'))['border-right-color'],
      'rgb(0, 0, 0)',
      'lazy-engine styles are not present'
    );

    // load lazy engine
    await visit('/use-lazy-engine');

    // lazy engine JS loaded
    let entriesAfter = Object.entries(window.require.entries).length;
    assert.ok(window.require.entries['lazy-engine/_app_/helpers/duplicated-helper']);
    assert.ok(entriesAfter > entriesBefore);
    assert.equal(currentURL(), '/use-lazy-engine');
    assert.dom('[data-test-lazy-engine-main] > h1').containsText('Lazy engine');
    assert.dom('[data-test-duplicated-helper]').containsText('from-lazy-engine');

    // lazy engine styles are loaded
    await visit('/style-check');

    assert.equal(
      getComputedStyle(document.querySelector('.shared-style-target'))['border-left-color'],
      'rgb(0, 0, 255)',
      'eager-engine styles are still present'
    );

    assert.equal(
      getComputedStyle(document.querySelector('.shared-style-target'))['border-right-color'],
      'rgb(255, 0, 0)',
      'now lazy-engine styles are present'
    );
  });

  test('eager-engine', async function(assert) {
    await visit('/use-eager-engine');
    assert.equal(currentURL(), '/use-eager-engine');
    assert.dom('[data-test-eager-engine-main] > h1').containsText('Eager engine');
    assert.dom('[data-test-truth-helpers-ok]').exists();
    assert.dom('[data-test-duplicated-helper]').containsText('from-eager-engine-helper');
  });
});
