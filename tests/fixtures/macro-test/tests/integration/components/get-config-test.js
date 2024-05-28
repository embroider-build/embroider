import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';
import { precompileTemplate } from "@ember/template-compilation";

module('Integration | Macro | getConfig', function(hooks) {
  setupRenderingTest(hooks);

  test('macroGetOwnConfig in content position', async function(assert) {
    await render(hbs`{{macroGetOwnConfig "mode"}}`);
    assert.equal(this.element.textContent.trim(), 'amazing');
  });

  test('macroGetConfig in content position', async function(assert) {
    await render(hbs`{{macroGetConfig "ember-source" "color"}}`);
    assert.equal(this.element.textContent.trim(), 'orange');
  });

  test('macroGetOwnConfig in subexpression position', async function(assert) {
    await render(hbs`{{#with (macroGetOwnConfig "mode") as |m|}}{{m}}{{/with}}`);
    assert.equal(this.element.textContent.trim(), 'amazing');
  });

  test('macroGetConfig in subexpression position', async function(assert) {
    await render(hbs`{{#with (macroGetConfig "ember-source" "color") as |m|}}{{m}}{{/with}}`);
    assert.equal(this.element.textContent.trim(), 'orange');
  });

  test('macroGetOwnConfig emits number', async function(assert) {
    assert.expect(1);
    function myAssertion(value) {
      assert.equal(value, 42);
    }
    await render(precompileTemplate(`{{myAssertion (macroGetOwnConfig "count") }}`, {
      scope: () => ({ myAssertion })
    }));
  });

  test('macroGetOwnConfig emits boolean', async function(assert) {
    assert.expect(1);
    function myAssertion(value) {
      assert.equal(value, true);
    }
    await render(precompileTemplate(`{{myAssertion (macroGetOwnConfig "inner" "items" "0" "awesome") }}`, {
      scope: () => ({ myAssertion })
    }));
  });

  test('macroGetOwnConfig emits string', async function(assert) {
    assert.expect(1);
    function myAssertion(value) {
      assert.strictEqual(value, 'amazing');
    }
    await render(precompileTemplate(`{{myAssertion (macroGetOwnConfig "mode") }}`, {
      scope: () => ({ myAssertion })
    }));
  });

  test('macroGetOwnConfig emits null', async function(assert) {
    assert.expect(1);
    function myAssertion(value) {
      assert.strictEqual(value, null);
    }
    await render(precompileTemplate(`{{myAssertion (macroGetOwnConfig "inner" "description") }}`, {
      scope: () => ({ myAssertion })
    }));
  });

  test('macroGetOwnConfig emits complex pojo', async function(assert) {
    assert.expect(1);
    function myAssertion(value) {
      assert.deepEqual({
        ...value, 
        // this isn't what this test is actually checking for, we need to reuse this fixture between
        // different tests that this value will be different so it's easier to just remove from the
        // pojo
        EXPECTED_VERSION: null 
      }, {
        mode: 'amazing',
        count: 42,
        inner: {
          items: [
            { name: 'Arthur', awesome: true }
          ],
          description: null
        },
        EXPECTED_VERSION: null,
      });
    }
    await render(precompileTemplate(`{{myAssertion (macroGetOwnConfig) }}`, {
      scope: () => ({ myAssertion })
    }));
  });

  test('macroGetOwnConfig emits undefined for missing key', async function(assert) {
    assert.expect(1);
    function myAssertion(value) {
      assert.strictEqual(value, undefined);
    }
    await render(precompileTemplate(`{{myAssertion (macroGetOwnConfig "inner" "notAThing") }}`, {
      scope: () => ({ myAssertion })
    }));
  });

  test('macroGetConfig emits undefined for missing config', async function(assert) {
    assert.expect(1);
    function myAssertion(value) {
      assert.strictEqual(value, undefined);
    }
    await render(precompileTemplate(`{{myAssertion (macroGetConfig "ember-cli") }}`, {
      scope: () => ({ myAssertion })
    }));
  });
});
