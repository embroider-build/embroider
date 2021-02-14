import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { click, render } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';

module('Integration | Macro | macroMaybeAttrs', function (hooks) {
  setupRenderingTest(hooks);

  test('macroMaybeAttrs when true', async function (assert) {
    await render(hbs`<div data-test-target {{macroMaybeAttrs true data-optional data-flavor="vanilla" }} ></div>`);
    let target = this.element.querySelector('[data-test-target]');
    assert.ok(target.matches('[data-optional]'), 'found data-optional');
    assert.ok(target.matches('[data-flavor="vanilla"]'), 'found data-flavor');
  });

  test('macroMaybeAttrs propagates bound paths', async function (assert) {
    this.set('flavor', 'vanilla');
    await render(hbs`<div data-test-target {{macroMaybeAttrs true data-flavor=this.flavor }} ></div>`);
    let target = this.element.querySelector('[data-test-target]');
    assert.ok(target.matches('[data-flavor="vanilla"]'), 'found data-flavor');
  });

  test('macroMaybeAttrs when false', async function (assert) {
    await render(hbs`<div data-test-target {{macroMaybeAttrs false data-optional data-flavor="vanilla" }} ></div>`);
    let target = this.element.querySelector('[data-test-target]');
    assert.ok(!target.matches('[data-optional]'));
    assert.ok(!target.matches('[data-flavor="vanilla"]'));
  });

  test('macroMaybeAttrs leaves other modifiers alone', async function (assert) {
    assert.expect(1);
    this.doThing = function () {
      assert.ok(true, 'it ran');
    };
    await render(
      hbs`<div data-test-target {{action doThing}} {{macroMaybeAttrs false data-optional data-flavor="vanilla" }} ></div>`
    );
    let target = this.element.querySelector('[data-test-target]');
    await click(target);
  });
});
