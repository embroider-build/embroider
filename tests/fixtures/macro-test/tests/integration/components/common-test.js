import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';

module('Integration | Macro | common', function(hooks) {
  setupRenderingTest(hooks);

  test('our macros do not shadow local variables', async function(assert) {
    await render(hbs`{{#let "hello" as |macroDependencySatisfies|}} {{macroDependencySatisfies}} {{/let}}`);
    assert.equal(this.element.textContent.trim(), 'hello');
  });

});
