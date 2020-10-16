import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render } from '@ember/test-helpers';
import { hbs } from 'ember-cli-htmlbars';
import { setComponentTemplate } from '@ember/component';
import templateOnlyComponent from '@ember/component/template-only';
import { setupDeprecationAssertions } from '../../deprecation-assertions';

// import { ensureSafeComponent } from '@embroider/addon';

module('Integration | Helper | ensure-safe-component', function (hooks) {
  setupRenderingTest(hooks);
  setupDeprecationAssertions(hooks);

  test('template usage with curried component value', async function (assert) {
    this.set('name', 'some-component');
    this.owner.register(
      'component:inner',
      setComponentTemplate(
        hbs`
        {{#let (ensure-safe-component @name) as |Thing|}}
          <Thing />
        {{/let}}
        `,
        templateOnlyComponent()
      )
    );
    await render(hbs`
      <Inner @name={{component "some-component"}} />
    `);
    assert.equal(this.element.textContent.trim(), 'hello from some-component');
  });

  test('template usage with string value', async function (assert) {
    this.set('name', 'some-component');
    await assert.expectDeprecation(async () => {
      await render(hbs`
      {{#let (ensure-safe-component this.name) as |Thing|}}
        <Thing />
      {{/let}}
   `);
    }, /You're trying to invoke the component "some-component" by passing its name as a string/);
    assert.equal(this.element.textContent.trim(), 'hello from some-component');
  });
});
