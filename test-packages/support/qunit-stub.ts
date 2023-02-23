// our tests import some libraries that extend the global QUnit assertions. When
// our tests are loaded by QUnit, that works normally.
//
// But scenario-tester also has commands that load all our tests just to
// identify what scenarios are in them, and those won't have the qunit globals.
//
// Ultimately, the fault here lies with QUnit for using a globals-based API.
(globalThis as any).QUnit = {
  assert: {},
};
