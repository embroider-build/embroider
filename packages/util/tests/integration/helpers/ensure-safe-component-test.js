import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render } from '@ember/test-helpers';
import { hbs } from 'ember-cli-htmlbars';
import { setComponentTemplate } from '@ember/component';
import Component from '@glimmer/component';
import templateOnlyComponent from '@ember/component/template-only';
import { setupDeprecationAssertions } from '../../deprecation-assertions';
import { ensureSafeComponent } from '@embroider/util';
import SomeComponent from 'dummy/components/some-component';
import ColocatedExample from 'dummy/components/colocated-example';
import { setOwner } from '@ember/application';

module('Integration | Helper | ensure-safe-component', function (hooks) {
  setupRenderingTest(hooks);
  setupDeprecationAssertions(hooks);

  hooks.beforeEach(function () {
    // we need to pass an object with an owner to ensureSafeComponent. The test
    // context normally doesn't consider itself owned by `this.owner`!
    setOwner(this, this.owner);
  });

  test('string value', async function (assert) {
    await assert.expectDeprecation(async () => {
      this.set('thing', ensureSafeComponent('some-component', this));
    }, /You're trying to invoke the component "some-component" by passing its name as a string/);

    await render(hbs`
      <this.thing />
   `);
    assert.equal(this.element.textContent.trim(), 'hello from some-component');
  });

  test('template-only component class value', async function (assert) {
    this.set('thing', ensureSafeComponent(SomeComponent, this));
    await render(hbs`
      <this.thing />
   `);
    assert.equal(this.element.textContent.trim(), 'hello from some-component');
  });

  test('co-located component class value', async function (assert) {
    this.set('thing', ensureSafeComponent(ColocatedExample, this));
    await render(hbs`
      <this.thing />
   `);
    assert.equal(this.element.textContent.trim(), 'hello from colocated-example');
  });

  test('curried component value', async function (assert) {
    this.provider = ensureSafeComponent(
      setComponentTemplate(
        hbs`
        {{yield (component "some-component") }}
        `,
        templateOnlyComponent()
      ),
      this
    );
    this.consumer = ensureSafeComponent(
      setComponentTemplate(
        hbs`
        <this.custom />
        `,
        class extends Component {
          get custom() {
            return ensureSafeComponent(this.args.custom, this);
          }
        }
      ),
      this
    );
    await render(hbs`
      <this.provider as |P|>
        <this.consumer @custom={{P}}/>
      </this.provider>
    `);
    assert.equal(this.element.textContent.trim(), 'hello from some-component');
  });

  test('template helper with curried component value', async function (assert) {
    this.set('name', 'some-component');
    this.inner = ensureSafeComponent(
      setComponentTemplate(
        hbs`
        {{#let (ensure-safe-component @name) as |Thing|}}
          <Thing />
        {{/let}}
        `,
        templateOnlyComponent()
      ),
      this
    );
    await render(hbs`
      <this.inner @name={{component "some-component"}} />
    `);
    assert.equal(this.element.textContent.trim(), 'hello from some-component');
  });

  test('template helper with string value', async function (assert) {
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
