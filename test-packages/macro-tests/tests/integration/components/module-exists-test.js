import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';
import { helper } from '@ember/component/helper';

module('Integration | Macro | moduleExists', function(hooks) {
  setupRenderingTest(hooks);

  test('macroModuleExists in content position', async function(assert) {
    await render(hbs`{{macroModuleExists "ember-cli/lib/broccoli/ember-app" }}`);
    assert.equal(this.element.textContent.trim(), 'true');
  });

  test('macroModuleExists in subexpression position', async function(assert) {
    assert.expect(1);
    this.owner.register('helper:my-assertion', helper(function([value]) {
      assert.strictEqual(value, true);
    }));
    await render(hbs`{{my-assertion (macroModuleExists "ember-cli/lib/broccoli-ember-app") }}`);
  });

  test('macroModuleExists emits false for missing module', async function(assert) {
    assert.expect(1);
    this.owner.register('helper:my-assertion', helper(function([value]) {
      assert.strictEqual(value, false);
    }));
    await render(hbs`{{my-assertion (macroModuleExists "not-a-package") }}`);
  });

});
