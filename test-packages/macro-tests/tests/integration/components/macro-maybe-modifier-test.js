import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { click, render } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';

module('Integration | Macro | macroMaybeModifier', function (hooks) {
  setupRenderingTest(hooks);

  test('macroMaybeModifier when true', async function (assert) {
    let called = false;
    this.set('action', () => (called = true));
    await render(hbs`<button data-test-target {{macroMaybeModifier true action this.action}}></button>`);
    await click('[data-test-target]');
    assert.ok(called, 'action modifier works');
  });

  test('macroMaybeModifier when false', async function (assert) {
    let called = false;
    this.set('action', () => (called = true));
    await render(hbs`<button data-test-target {{macroMaybeModifier false action this.action}}></button>`);
    await click('[data-test-target]');
    assert.notOk(called, 'action modifier was not applied');
  });

  test('macroMaybeModifier leaves other modifiers alone', async function (assert) {
    let called = false;
    this.set('action', () => (called = true));
    await render(
      hbs`<div data-test-target {{action this.action}} {{macroMaybeModifier false action this.someOtherAction}} ></div>`
    );
    await click('[data-test-target]');
    assert.ok(called, 'other modifier works');
  });
});
