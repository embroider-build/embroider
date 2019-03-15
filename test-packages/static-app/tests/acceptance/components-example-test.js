import { module, test } from 'qunit';
import { visit } from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';
import { getOwnConfig } from '@embroider/macros';

module('Acceptance | components-example', function(hooks) {
  setupApplicationTest(hooks);

  test('static components', async function(assert) {
    await visit('/components-example');

    let button = document.querySelector('.md-button');
    assert.ok(button, 'found paper-button');
    if (button) {
      assert.equal(getComputedStyle(button)['background-color'], "rgb(63, 81, 181)", "paper-button has its CSS");
    }

    let components = [...document.querySelectorAll("[data-component-name]")].map(elt => elt.dataset.componentName);
    assert.ok(components.includes('paper-button'), 'expected to find paper-button');

    if (getOwnConfig().isClassic) {
      assert.ok(components.includes('paper-dialog'), 'expected to find paper-dialog in classic build');
    } else {
      assert.ok(!components.includes('paper-dialog'), 'expected not to find paper-dialog in embroider build');
    }
  });
});
