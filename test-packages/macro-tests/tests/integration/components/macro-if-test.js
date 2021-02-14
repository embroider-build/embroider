import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';
import { helper } from '@ember/component/helper';

module('Integration | Macro | macroCondition', function (hooks) {
  setupRenderingTest(hooks);

  test('macroCondition in content position when true', async function (assert) {
    await render(hbs`{{#if (macroCondition true)}}red{{else}}blue{{/if}}`);
    assert.equal(this.element.textContent.trim(), 'red');
  });

  test('macroCondition in content position when false', async function (assert) {
    await render(hbs`{{#if (macroCondition false)}}red{{else}}blue{{/if}}`);
    assert.equal(this.element.textContent.trim(), 'blue');
  });

  test('macroCondition in content position when false with no alternate', async function (assert) {
    await render(hbs`{{#if (macroCondition false)}}red{{/if}}`);
    assert.equal(this.element.textContent.trim(), '');
  });

  test('macroCondition in subexpression position when true', async function (assert) {
    assert.expect(1);
    this.owner.register(
      'helper:my-assertion',
      helper(function ([value]) {
        assert.strictEqual(value, 'red');
      })
    );
    await render(hbs`{{my-assertion (if (macroCondition true) 'red' 'blue') }}`);
  });

  test('macroCondition inside string', async function (assert) {
    assert.expect(1);
    await render(hbs`<div class="target {{if (macroCondition true) 'red' 'blue' }}"></div>`);
    assert.ok(this.element.querySelector('.target').matches('.red'));
  });

  test('macroCondition in subexpression position when false', async function (assert) {
    assert.expect(1);
    this.owner.register(
      'helper:my-assertion',
      helper(function ([value]) {
        assert.strictEqual(value, 'blue');
      })
    );
    await render(hbs`{{my-assertion (if (macroCondition false) 'red' 'blue') }}`);
  });

  test('macroCondition in subexpression position when false with no alternate', async function (assert) {
    assert.expect(1);
    this.owner.register(
      'helper:my-assertion',
      helper(function ([value]) {
        assert.strictEqual(value, undefined);
      })
    );
    await render(hbs`{{my-assertion (if (macroCondition false) 'red') }}`);
  });

  test('macroCondition composes with other macros, true case', async function (assert) {
    assert.expect(1);
    this.owner.register(
      'helper:my-assertion',
      helper(function ([value]) {
        assert.strictEqual(value, 'red');
      })
    );
    await render(
      hbs`{{my-assertion (if (macroCondition (macroDependencySatisfies 'ember-source' '3.x')) 'red' 'blue') }}`
    );
  });

  test('macroCondition composes with other macros, false case', async function (assert) {
    assert.expect(1);
    this.owner.register(
      'helper:my-assertion',
      helper(function ([value]) {
        assert.strictEqual(value, 'blue');
      })
    );
    await render(
      hbs`{{my-assertion (if (macroCondition (macroDependencySatisfies 'ember-source' '10.x')) 'red' 'blue') }}`
    );
  });

  test('macroCondition composes with self', async function (assert) {
    assert.expect(1);
    this.owner.register(
      'helper:my-assertion',
      helper(function ([value]) {
        assert.strictEqual(value, 'red');
      })
    );
    await render(hbs`{{my-assertion (if (macroCondition true) (if (macroCondition false) 'green' 'red') 'blue') }}`);
  });
});
