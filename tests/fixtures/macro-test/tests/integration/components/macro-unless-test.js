import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render, click } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';
import { precompileTemplate } from "@ember/template-compilation";

module('Integration | Macro | macroCondition + {{unless}}', function (hooks) {
  setupRenderingTest(hooks);

  test('macroCondition in content position when true', async function (assert) {
    await render(hbs`{{#unless (macroCondition true)}}red{{else}}blue{{/unless}}`);
    assert.equal(this.element.textContent.trim(), 'blue');
  });

  test('macroCondition in content position when false', async function (assert) {
    await render(hbs`{{#unless (macroCondition false)}}red{{else}}blue{{/unless}}`);
    assert.equal(this.element.textContent.trim(), 'red');
  });

  test('macroCondition in content position when true with no alternate', async function (assert) {
    await render(hbs`{{#unless (macroCondition true)}}red{{/unless}}`);
    assert.equal(this.element.textContent.trim(), '');
  });

  test('macroCondition in subexpression position when true', async function (assert) {
    assert.expect(1);
    function myAssertion(value) {
        assert.strictEqual(value, 'blue');
    }
    await render(precompileTemplate(`{{myAssertion (unless (macroCondition true) 'red' 'blue') }}`, {
      scope: () => ({ myAssertion })
    }));
  });

  test('macroCondition inside string', async function (assert) {
    assert.expect(1);
    await render(hbs`<div class="target {{unless (macroCondition true) 'red' 'blue' }}"></div>`);
    assert.ok(this.element.querySelector('.target').matches('.blue'));
  });

  test('macroCondition in subexpression position when false', async function (assert) {
    assert.expect(1);
    function myAssertion(value) {
        assert.strictEqual(value, 'red');
    }
    await render(precompileTemplate(`{{myAssertion (unless (macroCondition false) 'red' 'blue') }}`, {
      scope: () => ({ myAssertion })
    }));
  });

  test('macroCondition in subexpression position when true with no alternate', async function (assert) {
    assert.expect(1);
    function myAssertion(value) {
        assert.strictEqual(value, undefined);
    }
    await render(precompileTemplate(`{{myAssertion (unless (macroCondition true) 'red') }}`, {
      scope: () => ({ myAssertion })
    }));
  });

  test('macroCondition composes with other macros, true case', async function (assert) {
    assert.expect(1);
    function myAssertion(value) {
        assert.strictEqual(value, 'blue');
      }
    await render(precompileTemplate(`{{myAssertion (unless (macroCondition (macroDependencySatisfies 'ember-source' '*')) 'red' 'blue') }}`, {
      scope: () => ({ myAssertion })
    }));
  });

  test('macroCondition composes with other macros, false case', async function (assert) {
    assert.expect(1);
    function myAssertion(value) {
        assert.strictEqual(value, 'red');
      }
      await render(precompileTemplate(`{{myAssertion (unless (macroCondition (macroDependencySatisfies 'ember-source' '10.x')) 'red' 'blue') }}`, {
        scope: () => ({ myAssertion })
      }));
  });

  test('macroCondition composes with self', async function (assert) {
    assert.expect(1);
    function myAssertion(value) {
        assert.strictEqual(value, 'red');
      }
      await render(precompileTemplate(`{{myAssertion (unless (macroCondition false) (unless (macroCondition true) 'green' 'red') 'blue') }}`, {
        scope: () => ({ myAssertion })
      }));
  });

  test('macroCondition in modifier position when false', async function (assert) {
    assert.expect(1);
    this.doThing = function () {
      assert.ok(true, 'it ran');
    };
    await render(
      hbs('<button {{(unless (macroCondition false) on) "click" this.doThing}}>Submit</button>', {
        insertRuntimeErrors: true,
      })
    );
    await click('button');
  });

  test('macroCondition in modifier position when true', async function (assert) {
    assert.expect(1);
    this.doThing = function () {
      assert.ok(true, 'it ran');
    };
    await render(
      hbs('<button {{(unless (macroCondition false) on off) "click" this.doThing}}>Submit</button>', {
        insertRuntimeErrors: true,
      })
    );
    await click('button');
  });

  test('macroCondition in modifier position when true with no alternate', async function (assert) {
    assert.expect(0);
    this.doThing = function () {
      assert.ok(true, 'it ran');
    };
    await render(
      hbs('<button {{(unless (macroCondition true) on) "click" this.doThing}}>Submit</button>', {
        insertRuntimeErrors: true,
      })
    );
    await click('button');
  });
});
