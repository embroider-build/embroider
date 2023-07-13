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

import esc from '../src/addon/es-compat';

const ERROR_REGEX =
  /this method is really implemented at compile time via a babel plugin. If you're seeing this exception, something went wrong/;

describe(`type-only exports`, function () {
  test('dependencySatisfies exists', function () {
    expect(dependencySatisfies).toBeDefined();
    expect(dependencySatisfies).toThrow(ERROR_REGEX);
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

describe(`es-compat`, function () {
  test('ES module are untouched', function () {
    let esm = {
      __esModule: true,
      default: class ESM {},
      named: function named() {},
    };

    expect(esc(esm)).toEqual(esm);
  });

  test('CJS module are shimmed', function () {
    let cjs = {
      named: function named() {},
      another: function another() {},
    };

    expect(esc(cjs).default.named).toEqual(cjs.named);
    expect(esc(cjs).default.another).toEqual(cjs.another);

    expect(esc(cjs).named).toEqual(cjs.named);
    expect(esc(cjs).another).toEqual(cjs.another);
  });
});
