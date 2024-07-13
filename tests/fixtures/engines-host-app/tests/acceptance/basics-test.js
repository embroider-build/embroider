import { module, test } from 'qunit';
import { visit, currentURL } from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';
import { dependencySatisfies } from '@embroider/macros';

function arrayOfCSSRules(styleSheets, cssSelector, cssProperty) {
  let values = [];

  for (let stylesheet of styleSheets) {
    for (let cssRule of stylesheet.cssRules) {
      if (cssRule.selectorText === cssSelector && cssRule.style[cssProperty]) {
        values.push(cssRule.style[cssProperty].replaceAll('"', ''));
      }
    }
  }

  return values.sort();
}
function createLazyEngineTest(type) {
  return async function (assert) {
    await visit('/');
    let entriesBefore = Object.entries(window.require.entries).length;
    let rules = arrayOfCSSRules(document.styleSheets, '.shared-style-target', 'content');

    if (ensureCSSisLazy) {
      assert.deepEqual(
        rules,
        [
          'engines-host-app/vendor/styles.css',
          'eager-engine/addon/styles/addon.css',
          'engines-host-app/app/styles/app.css',
        ].sort()
      );
    }

    await visit('/style-check');
    assert.dom('.shared-style-target').exists();

    assert.equal(
      getComputedStyle(document.querySelector('.shared-style-target'))['border-left-width'],
      '2px',
      'eager-engine styles are present'
    );

    if (ensureCSSisLazy) {
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
    }

    assert.notOk(!!window.require.entries['lazy-engine/helpers/duplicated-helper']);

    await visit('/use-lazy-engine');
    let entriesAfter = Object.entries(window.require.entries).length;
    if (type === 'safe') {
      assert.ok(!!window.require.entries['lazy-engine/helpers/duplicated-helper'], 'in safe mode we expect to see lazy-engine/helpers/duplicated-helper but its not there');
    } else {
      assert.notOk(!!window.require.entries['lazy-engine/helpers/duplicated-helper'], 'in optimized mode we expect to *not* see lazy-engine/helpers/duplicated-helper but it is there');
    }
    assert.ok(entriesAfter > entriesBefore);
    assert.equal(currentURL(), '/use-lazy-engine');
    assert.dom('[data-test-lazy-engine-main] > h1').containsText('Lazy engine');
    assert.dom('[data-test-duplicated-helper]').containsText('from-lazy-engine');

    rules = arrayOfCSSRules(document.styleSheets, '.shared-style-target', 'content');

    assert.deepEqual(
      rules,
      [
        'engines-host-app/vendor/styles.css',
        'eager-engine/addon/styles/addon.css',
        'engines-host-app/app/styles/app.css',
        'macro-sample-addon/addon/styles/addon.css',
        'lazy-engine/addon/styles/addon.css',
        ensureCSSisLazy ? undefined : 'lazy-in-repo-engine/addon/styles/addon.css',
      ]
        .filter(Boolean)
        .sort()
    );

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
  };
}

function createLazyInRepoEngineTest(type) {
  return async function (assert) {
    await visit('/');
    const entriesBefore = Object.entries(window.require.entries).length;
    let rules = arrayOfCSSRules(document.styleSheets, '.shared-style-target', 'content');

    if (ensureCSSisLazy) {
      assert.notOk(rules.includes('lazy-in-repo-engine/addon/styles/addon.css'));
    }

    await visit('/style-check');
    assert.dom('.shared-style-target').exists();

    assert.equal(
      getComputedStyle(document.querySelector('.shared-style-target'))['border-left-width'],
      '2px',
      'eager-engine styles are present'
    );

    if (ensureCSSisLazy) {
      assert.equal(
        getComputedStyle(document.querySelector('.shared-style-target'))['border-bottom-width'],
        '0px',
        'lazy-in-repo-engine addon styles are not present'
      );
    }

    await visit('/use-lazy-in-repo-engine');
    const entriesAfter = Object.entries(window.require.entries).length;
    if (type === 'safe') {
      assert.ok(!!window.require.entries['lazy-in-repo-engine/helpers/duplicated-helper']);
    } else {
      assert.notOk(!!window.require.entries['lazy-in-repo-engine/helpers/duplicated-helper']);
    }
    assert.ok(entriesAfter > entriesBefore);
    assert.equal(currentURL(), '/use-lazy-in-repo-engine');
    assert.dom('[data-test-lazy-in-repo-engine-main] > h1').containsText('Lazy In-Repo Engine');
    assert.dom('[data-test-duplicated-helper]').containsText('from-lazy-in-repo-engine');

    rules = arrayOfCSSRules(document.styleSheets, '.shared-style-target', 'content');

    assert.ok(rules.includes('lazy-in-repo-engine/addon/styles/addon.css'));

    await visit('/style-check');

    assert.equal(
      getComputedStyle(document.querySelector('.shared-style-target'))['border-left-width'],
      '2px',
      'eager-engine styles are still present'
    );

    assert.equal(
      getComputedStyle(document.querySelector('.shared-style-target'))['border-bottom-width'],
      '2px',
      'lazy-in-repo-engine addon styles are present'
    );
  };
}
// We don't yet support lazy CSS in apps that are using fastboot. This test
// application runs both with and without fastboot.
const ensureCSSisLazy = !dependencySatisfies('ember-cli-fastboot', '*');

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
  test('@safe lazy-engine', createLazyEngineTest('safe'));
  test('@optimized lazy-engine', createLazyEngineTest('optimized'));

  // See TODO comment in above test
  //skip('lazy engines own app tree is lazy', function () {});

  // this test must be the first test that loads the lazy-in-repo-engine as after it has loaded
  // it will not "unload" and we are checkign that these modules are entering require.entries
  // for the first time.
  test('@safe lazy-in-repo-engine', createLazyInRepoEngineTest('safe'));
  test('@optimized lazy-in-repo-engine', createLazyInRepoEngineTest('optimized'));

  test('eager-engine', async function (assert) {
    await visit('/use-eager-engine');
    assert.equal(currentURL(), '/use-eager-engine');
    assert.dom('[data-test-eager-engine-main] > h1').containsText('Eager engine');
    assert.dom('[data-test-truth-helpers-ok]').exists();
    assert.dom('[data-test-duplicated-helper]').containsText('from-eager-engine-helper');
  });
});
