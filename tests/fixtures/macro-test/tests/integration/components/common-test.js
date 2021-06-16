import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';

module('Integration | Macro | common', function(hooks) {
  setupRenderingTest(hooks);

  test('our macros do not shadow local variables', async function(assert) {
    await render(hbs`{{#with "hello" as |macroDependencySatisfies|}} {{macroDependencySatisfies}} {{/with}}`);
    assert.equal(this.element.textContent.trim(), 'hello');
  });

});
