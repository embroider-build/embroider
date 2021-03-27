import { registerDeprecationHandler } from '@ember/debug';

class DeprecationMonitor {
  constructor(assert) {
    this.assert = assert;
  }

  buffer = [];
  async expectDeprecation(cb, pattern) {
    let start = this.buffer.length;
    await cb();
    let candidates = this.buffer.slice(start, start.length);
    let found = candidates.find((candidate) => pattern.test(candidate.message));
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
        actual: candidates.map((c) => c.message),
        expected: pattern.toString(),
        message:
          'Expected deprecation during test, but no matching deprecation was found.',
      });
    }
  }
  sawDeprecation(message) {
    this.buffer.push({ message, handled: false });
  }
  assertNoUnexpected() {
    let unexpected = this.buffer
      .filter((entry) => !entry.handled)
      .map((entry) => entry.message);
    this.assert.pushResult({
      result: unexpected.length === 0,
      actual: unexpected,
      expected: [],
      message:
        unexpected.length === 0
          ? 'No unexpected deprecations'
          : 'Unexpected deprecations',
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

export function setupDeprecationAssertions(hooks) {
  hooks.beforeEach(function (assert) {
    active = new DeprecationMonitor(assert);
    assert.expectDeprecation = active.expectDeprecation.bind(active);
  });
  hooks.afterEach(function () {
    active.assertNoUnexpected();
    active = undefined;
  });
}
