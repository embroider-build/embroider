// our tests import some libraries that extend the global QUnit assertions. When
// our tests are loaded by QUnit, that works normally. But our suite-setup-util
// also tries to load all our tests just to list which tests are in there, and
// it can cause them to blow up on not finding the global qunit.
(globalThis as any).QUnit = {
  assert: {},
};
