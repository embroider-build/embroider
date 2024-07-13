import { module, test } from 'qunit';

module('Acceptance | Custom app boot', function () {
  test('ensure app boot up is happening from custom app-boot', function (assert) {
    assert.equal(window.LoadedFromCustomAppBoot, true, `expected: 'This dummy app to inject custom app-boot to inject custom app-boot`);
  });
});