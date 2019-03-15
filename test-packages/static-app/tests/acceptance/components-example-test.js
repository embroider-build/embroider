import { module, test } from 'qunit';
import { visit } from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';
import { getOwnConfig, macroIf } from '@embroider/macros';

module('Acceptance | components-example', function(hooks) {
  setupApplicationTest(hooks);

  test('static components', async function(assert) {
    await visit('/components-example');

    assert.ok(document.querySelector('.md-button'), 'found paper-button');

    let components = [...document.querySelectorAll("[data-component-name]")].map(elt => elt.dataset.componentName);
    assert.ok(components.includes('paper-button'), 'expected to find paper-button');

    macroIf(getOwnConfig().isClassic, () => {
      assert.ok(components.includes('paper-dialog'), 'expected to find paper-dialog in classic build');
    }, () => {
      assert.ok(!components.includes('paper-dialog'), 'expected not to find paper-dialog in embroider build');
    });
  });
});
