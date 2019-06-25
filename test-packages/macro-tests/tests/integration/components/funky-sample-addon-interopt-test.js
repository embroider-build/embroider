import { module, test } from 'qunit';
import funkyAddon from 'funky-sample-addon';
import FakeModule from 'fake-module'

const {
  foo,
  bar
} = FakeModule;

module("funky-sample-addon-interopt-test");

test("it works", function(assert) {
  assert.ok(funkyAddon(), 'works correctly');
  assert.ok(foo.isFoo, 'is the right export');
  assert.ok(bar.isBar, 'is the right export');
});
