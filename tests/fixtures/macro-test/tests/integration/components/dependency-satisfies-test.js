import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';
import { precompileTemplate } from "@ember/template-compilation";

module('Integration | Macro | dependencySatisfies', function(hooks) {
  setupRenderingTest(hooks);

  test('macroDependencySatisfies in content position', async function(assert) {
    await render(hbs`{{macroDependencySatisfies "ember-cli" "*"}}`);
    assert.equal(this.element.textContent.trim(), 'true');
  });

  test('macroDependencySatisfies in subexpression position', async function(assert) {
    assert.expect(1);
    function myAssertion(value) {
      assert.strictEqual(value, true);
    }
    await render(precompileTemplate(`{{myAssertion (macroDependencySatisfies "ember-cli" "*") }}`, {
      scope: () => ({ myAssertion })
    }));
  });

  test('macroDependencySatisfies emits false for missing package', async function(assert) {
    assert.expect(1);
    function myAssertion(value) {
      assert.strictEqual(value, false);
    }
    await render(precompileTemplate(`{{myAssertion (macroDependencySatisfies "not-a-package" "*") }}`, {
      scope: () => ({ myAssertion })
    }));
  });

  test('macroDependencySatisfies emits false for out-of-range package', async function(assert) {
    assert.expect(1);
    function myAssertion(value) {
      assert.strictEqual(value, false);
    }
    await render(precompileTemplate(`{{myAssertion (macroDependencySatisfies "ember-cli" "0.0.1") }}`, {
      scope: () => ({ myAssertion })
    }));
  });

});
