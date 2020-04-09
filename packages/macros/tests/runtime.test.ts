import {
  dependencySatisfies,
  macroCondition,
  each,
  importSync,
  getConfig,
  getOwnConfig,
  failBuild,
  moduleExists,
} from '../src/index';

const ERROR_REGEX = /this method is really implemented at compile time via a babel plugin. If you're seeing this exception, something went wrong/;

describe(`run-time macro exports`, function() {
  test('dependencySatisfies exists', function() {
    expect(dependencySatisfies).toBeDefined();
    expect(dependencySatisfies).toThrow(ERROR_REGEX);
  });

  test('macroCondition exists', function() {
    expect(macroCondition).toBeDefined();
    expect(macroCondition(true)).toEqual(true);
    expect(macroCondition(false)).toEqual(false);
  });

  test('each exists', function() {
    const names = ['Edward', 'Tom', 'Yehuda'];
    expect(each).toBeDefined();
    expect(each(names)).toEqual(names);
    expect(each).toThrow('the argument to the each() macro must be an array');
  });

  test('importSync exists', function() {
    expect(importSync).toBeDefined();
    expect(importSync).toThrow(ERROR_REGEX);
  });

  test('getConfig exists', function() {
    expect(getConfig).toBeDefined();
  });

  test('getOwnConfig exists', function() {
    expect(getOwnConfig).toBeDefined();
  });

  test('failBuild exists', function() {
    expect(failBuild).toBeDefined();
    expect(failBuild).toThrow(ERROR_REGEX);
  });

  test('moduleExists exists', function() {
    expect(moduleExists).toBeDefined();
    expect(moduleExists).toThrow(ERROR_REGEX);
  });
});
