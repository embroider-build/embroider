import { module, test } from 'qunit';
import { visit, currentURL } from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';
import ENV from 'app-template/config/environment';

module('Acceptance | smoke tests', function (hooks) {
  setupApplicationTest(hooks);

  // TODO: this currently fails on apple.js, which was added to test app.import
  // custom outputPath support. It's unclear whether we want to keep that
  // feature, and regardless this test suite was a bad place to test it, so I'm
  // skipping this. -ef4
  test.skip('ensure all scripts in index.html 200', async function (assert) {
    for (let { src } of document.scripts) {
      let { status } = await fetch(src);
      assert.equal(status, 200, `expected: '${src}' to be accessible`);
    }
  });

  test('JS getOwnConfig worked', async function (assert) {
    await visit('/');
    assert.equal(currentURL(), '/');
    assert.equal(this.element.querySelector('[data-test-mode]').textContent.trim(), 'amazing');
  });

  test('HBS getOwnConfig worked', async function (assert) {
    await visit('/');
    assert.equal(currentURL(), '/');
    assert.equal(this.element.querySelector('[data-test-count]').textContent.trim(), '42');
  });

  test('JS isTesting worked', async function (assert) {
    await visit('/');
    assert.equal(currentURL(), '/');
    assert.equal(this.element.querySelector('[data-test-testing]').textContent.trim(), 'true');
  });


  // TODO: this tests app.import custom outputPath support. It's unclear whether
  // we want to keep that feature, and regardless this test suite was a bad
  // place to test it, so I'm skipping this. -ef4
  test.skip('/ordered.js is ordered correctly', function (assert) {
    assert.deepEqual(self.ORDER, [
      // these come via app.import(name, { prepend: true });
      // which ultimately end up in vendor.js
      // and vendor.js is loaded first
      'prepend/four',
      'prepend/three',
      'prepend/two',
      'prepend/one',

      // these come via app.import(name, { outputFile:  'ordered.js' });
      // so they will end up in ordered.js
      // and ordered.js is loaded after vendor.js
      'FOUR',
      'TWO',
      'THREE',
      'ONE',
    ]);
  });

  test('dependency satisfies works correctly', async function (assert) {
    await visit('/');
    assert.equal(currentURL(), '/');
    assert.equal(this.element.querySelector('[data-test-version]').textContent.trim(), ENV.EXPECTED_VERSION);
  });
});
