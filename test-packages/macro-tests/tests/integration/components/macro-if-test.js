import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';
import { helper } from '@ember/component/helper';

module('Integration | Macro | macroIf', function(hooks) {
  setupRenderingTest(hooks);

  test('macroIf in content position when true', async function(assert) {
    await render(hbs`{{#macroIf true}}red{{else}}blue{{/macroIf}}`);
    assert.equal(this.element.textContent.trim(), 'red');
  });

  test('macroIf in content position when false', async function(assert) {
    await render(hbs`{{#macroIf false}}red{{else}}blue{{/macroIf}}`);
    assert.equal(this.element.textContent.trim(), 'blue');
  });

  test('macroIf in subexpression position when true', async function(assert) {
    assert.expect(1);
    this.owner.register('helper:my-assertion', helper(function([value]) {
      assert.strictEqual(value, 'red');
    }));
    await render(hbs`{{my-assertion (macroIf true 'red' 'blue') }}`);
  });

  test('macroIf in subexpression position when false', async function(assert) {
    assert.expect(1);
    this.owner.register('helper:my-assertion', helper(function([value]) {
      assert.strictEqual(value, 'blue');
    }));
    await render(hbs`{{my-assertion (macroIf false 'red' 'blue') }}`);
  });

  test('macroIf in element modifier position, when true', async function(assert) {
    await render(hbs`<div data-test-target {{macroIf true data-optional data-flavor="vanilla" }} ></div>`);
    let target = this.element.querySelector('[data-test-target]');
    assert.ok(target.matches('[data-optional]'));
    assert.ok(target.matches('[data-flavor="vanilla"]'));
  });

  test('macroIf in element modifier position, when false', async function(assert) {
    await render(hbs`<div data-test-target {{macroIf false data-optional data-flavor="vanilla" }} ></div>`);
    let target = this.element.querySelector('[data-test-target]');
    assert.ok(!target.matches('[data-optional]'));
    assert.ok(!target.matches('[data-flavor="vanilla"]'));
  });

  test('macroIf composes with other macros, true case', async function(assert) {
    assert.expect(1);
    this.owner.register('helper:my-assertion', helper(function([value]) {
      assert.strictEqual(value, 'red');
    }));
    await render(hbs`{{my-assertion (macroIf (macroDependencySatisfies 'ember-source' '3.x') 'red' 'blue') }}`);
  });

  test('macroIf composes with other macros, false case', async function(assert) {
    assert.expect(1);
    this.owner.register('helper:my-assertion', helper(function([value]) {
      assert.strictEqual(value, 'blue');
    }));
    await render(hbs`{{my-assertion (macroIf (macroDependencySatisfies 'ember-source' '10.x') 'red' 'blue') }}`);
  });

});
