import {
  appEmberSatisfies,
  dependencySatisfies,
  macroCondition,
  each,
  importSync,
  getConfig,
  getOwnConfig,
  failBuild,
  moduleExists,
} from '../src/index';

const ERROR_REGEX =
  /this method is really implemented at compile time via a babel plugin. If you're seeing this exception, something went wrong/;

describe(`type-only exports`, function () {
  test('dependencySatisfies exists', function () {
    expect(dependencySatisfies).toBeDefined();
    expect(dependencySatisfies).toThrow(ERROR_REGEX);
  });

  test('appEmberSatisfies exists', function () {
    expect(appEmberSatisfies).toBeDefined();
    expect(appEmberSatisfies).toThrow(ERROR_REGEX);
  });

  test('macroCondition exists', function () {
    expect(macroCondition).toBeDefined();
    expect(macroCondition).toThrow(ERROR_REGEX);
  });

  test('each exists', function () {
    expect(each).toBeDefined();
    expect(each).toThrow(ERROR_REGEX);
  });

  test('importSync exists', function () {
    expect(importSync).toBeDefined();
    expect(importSync).toThrow(ERROR_REGEX);
  });

  test('getConfig exists', function () {
    expect(getConfig).toBeDefined();
    expect(getConfig).toThrow(ERROR_REGEX);
  });

  test('getOwnConfig exists', function () {
    expect(getOwnConfig).toBeDefined();
    expect(getOwnConfig).toThrow(ERROR_REGEX);
  });

  test('failBuild exists', function () {
    expect(failBuild).toBeDefined();
    expect(failBuild).toThrow(ERROR_REGEX);
  });

  test('moduleExists exists', function () {
    expect(moduleExists).toBeDefined();
    expect(moduleExists).toThrow(ERROR_REGEX);
  });
});
