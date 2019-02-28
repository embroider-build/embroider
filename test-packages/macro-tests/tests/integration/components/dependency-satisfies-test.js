import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';
import { helper } from '@ember/component/helper';

module('Integration | Macro | dependencySatisfies', function(hooks) {
  setupRenderingTest(hooks);

  test('macroDependencySatisfies in content position', async function(assert) {
    await render(hbs`{{macroDependencySatisfies "ember-cli" "*"}}`);
    assert.equal(this.element.textContent.trim(), 'true');
  });

  test('macroDependencySatisfies in subexpression position', async function(assert) {
    assert.expect(1);
    this.owner.register('helper:my-assertion', helper(function([value]) {
      assert.strictEqual(value, true);
    }));
    await render(hbs`{{my-assertion (macroDependencySatisfies "ember-cli" "*") }}`);
  });

  test('macroDependencySatisfies emits false for missing package', async function(assert) {
    assert.expect(1);
    this.owner.register('helper:my-assertion', helper(function([value]) {
      assert.strictEqual(value, false);
    }));
    await render(hbs`{{my-assertion (macroDependencySatisfies "not-a-package" "*") }}`);
  });

  test('macroDependencySatisfies emits false for out-of-range package', async function(assert) {
    assert.expect(1);
    this.owner.register('helper:my-assertion', helper(function([value]) {
      assert.strictEqual(value, false);
    }));
    await render(hbs`{{my-assertion (macroDependencySatisfies "ember-cli" "0.0.1") }}`);
  });

});
