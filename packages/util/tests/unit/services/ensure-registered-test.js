import { module, test } from 'qunit';
import { setupTest } from 'ember-qunit';
import Component from '@glimmer/component';

module('Unit | Service | ensure-registered', function (hooks) {
  setupTest(hooks);

  const Klass1 = class extends Component {};
  const Klass2 = class extends Component {};

  test('it returns nonce for class', function (assert) {
    let service = this.owner.lookup('service:-ensure-registered');
    assert.strictEqual(service.register(Klass1), '-ensure0');
  });

  test('it returns different nonce for different class', function (assert) {
    let service = this.owner.lookup('service:-ensure-registered');
    assert.strictEqual(service.register(Klass1), '-ensure0');
    assert.strictEqual(service.register(Klass2), '-ensure1');
  });

  test('it returns same nonce for same class', function (assert) {
    let service = this.owner.lookup('service:-ensure-registered');
    assert.strictEqual(service.register(Klass1), '-ensure0');
    assert.strictEqual(service.register(Klass1), '-ensure0');
  });

  test('it registers component', function (assert) {
    let service = this.owner.lookup('service:-ensure-registered');
    assert.strictEqual(service.register(Klass1), '-ensure0');
    assert.ok(this.owner.hasRegistration('component:-ensure0'));
  });
});
