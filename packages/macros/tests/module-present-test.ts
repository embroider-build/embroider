import 'qunit';
const { test } = QUnit;

QUnit.module('module-present', function(hooks) {
  test('hello', function(assert) {
    assert.ok('yes');
  });
});
