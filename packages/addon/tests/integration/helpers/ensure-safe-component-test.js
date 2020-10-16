import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render } from '@ember/test-helpers';
import { hbs } from 'ember-cli-htmlbars';
import { setComponentTemplate } from '@ember/component';
import templateOnlyComponent from '@ember/component/template-only';
import { registerDeprecationHandler } from '@ember/debug';

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

class DeprecationMonitor {
  constructor(assert) {
    this.assert = assert;
  }

  buffer = [];
  async expectDeprecation(cb, pattern) {
    let start = this.buffer.length;
    await cb();
    let candidates = this.buffer.slice(start, start.length);
    let found = candidates.find(candidate => pattern.test(candidate.message));
    if (found) {
      found.handled = true;
      this.assert.pushResult({
        result: true,
        actual: found.message,
        expected: pattern.toString(),
        message: 'Found deprecation',
      });
    } else {
      this.assert.pushResult({
        result: false,
        actual: candidates.map(c => c.message),
        expected: pattern.toString(),
        message: 'Expected deprecation during test, but no matching deprecation was found.',
      });
    }
  }
  sawDeprecation(message) {
    this.buffer.push({ message, handled: false });
  }
  assertNoUnexpected() {
    let unexpected = this.buffer.filter(entry => !entry.handled).map(entry => entry.message);
    this.assert.pushResult({
      result: unexpected.length === 0,
      actual: unexpected,
      expected: [],
      message: unexpected.length === 0 ? 'No unexpected deprecations' : 'Unexpected deprecations',
    });
  }
}

let active;

registerDeprecationHandler(function (message, options, next) {
  if (active) {
    active.sawDeprecation(message);
  } else {
    next(message, options);
  }
});

function setupDeprecationAssertions(hooks) {
  hooks.beforeEach(function (assert) {
    active = new DeprecationMonitor(assert);
    assert.expectDeprecation = active.expectDeprecation.bind(active);
  });
  hooks.afterEach(function () {
    active.assertNoUnexpected();
    active = undefined;
  });
}
