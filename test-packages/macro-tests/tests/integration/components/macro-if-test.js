import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render, click } from '@ember/test-helpers';
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

  test('macroIf in content position when false with no alternate', async function(assert) {
    await render(hbs`{{#macroIf false}}red{{/macroIf}}`);
    assert.equal(this.element.textContent.trim(), '');
  });

  test('macroIf in subexpression position when true', async function(assert) {
    assert.expect(1);
    this.owner.register(
      'helper:my-assertion',
      helper(function([value]) {
        assert.strictEqual(value, 'red');
      })
    );
    await render(hbs`{{my-assertion (macroIf true 'red' 'blue') }}`);
  });

  test('macroIf inside string', async function(assert) {
    assert.expect(1);
    await render(hbs`<div class="target {{macroIf true 'red' 'blue' }}"></div>`);
    assert.ok(this.element.querySelector('.target').matches('.red'));
  });

  test('macroIf in subexpression position when false', async function(assert) {
    assert.expect(1);
    this.owner.register(
      'helper:my-assertion',
      helper(function([value]) {
        assert.strictEqual(value, 'blue');
      })
    );
    await render(hbs`{{my-assertion (macroIf false 'red' 'blue') }}`);
  });

  test('macroIf in subexpression position when false with no alternate', async function(assert) {
    assert.expect(1);
    this.owner.register(
      'helper:my-assertion',
      helper(function([value]) {
        assert.strictEqual(value, undefined);
      })
    );
    await render(hbs`{{my-assertion (macroIf false 'red') }}`);
  });

  test('macroMaybeAttrs when true', async function(assert) {
    await render(hbs`<div data-test-target {{macroMaybeAttrs true data-optional data-flavor="vanilla" }} ></div>`);
    let target = this.element.querySelector('[data-test-target]');
    assert.ok(target.matches('[data-optional]'), 'found data-optional');
    assert.ok(target.matches('[data-flavor="vanilla"]'), 'found data-flavor');
  });

  test('macroMaybeAttrs propagates bound paths', async function(assert) {
    this.set('flavor', 'vanilla');
    await render(hbs`<div data-test-target {{macroMaybeAttrs true data-flavor=this.flavor }} ></div>`);
    let target = this.element.querySelector('[data-test-target]');
    assert.ok(target.matches('[data-flavor="vanilla"]'), 'found data-flavor');
  });

  test('macroMaybeAttrs when false', async function(assert) {
    await render(hbs`<div data-test-target {{macroMaybeAttrs false data-optional data-flavor="vanilla" }} ></div>`);
    let target = this.element.querySelector('[data-test-target]');
    assert.ok(!target.matches('[data-optional]'));
    assert.ok(!target.matches('[data-flavor="vanilla"]'));
  });

  test('macroMaybeAttrs leaves other modifiers alone', async function(assert) {
    assert.expect(1);
    this.doThing = function() {
      assert.ok(true, 'it ran');
    };
    await render(
      hbs`<div data-test-target {{action doThing}} {{macroMaybeAttrs false data-optional data-flavor="vanilla" }} ></div>`
    );
    let target = this.element.querySelector('[data-test-target]');
    await click(target);
  });

  test('macroIf composes with other macros, true case', async function(assert) {
    assert.expect(1);
    this.owner.register(
      'helper:my-assertion',
      helper(function([value]) {
        assert.strictEqual(value, 'red');
      })
    );
    await render(hbs`{{my-assertion (macroIf (macroDependencySatisfies 'ember-source' '3.x') 'red' 'blue') }}`);
  });

  test('macroIf composes with other macros, false case', async function(assert) {
    assert.expect(1);
    this.owner.register(
      'helper:my-assertion',
      helper(function([value]) {
        assert.strictEqual(value, 'blue');
      })
    );
    await render(hbs`{{my-assertion (macroIf (macroDependencySatisfies 'ember-source' '10.x') 'red' 'blue') }}`);
  });
});
