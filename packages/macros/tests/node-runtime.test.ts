import {
  appEmberSatisfies,
  dependencySatisfies,
  macroCondition,
  each,
  importSync,
  getConfig,
  getOwnConfig,
  getGlobalConfig,
  isDevelopingApp,
  isTesting,
  failBuild,
  moduleExists,
} from '../src/node-runtime';

describe(`node runtime`, function () {
  test('dependencySatisfies returns true for installed package with matching range', function () {
    // semver is a real dependency of this package
    expect(dependencySatisfies('semver', '^7.0.0')).toBe(true);
  });

  test('dependencySatisfies returns false for non-existent package', function () {
    expect(dependencySatisfies('this-package-definitely-does-not-exist-xyz', '*')).toBe(false);
  });

  test('dependencySatisfies returns false for installed package outside range', function () {
    // semver is 7.x, so ^6.0.0 should not match
    expect(dependencySatisfies('semver', '^6.0.0')).toBe(false);
  });

  test('appEmberSatisfies returns false when ember-source is not present', function () {
    // ember-source is not installed in this package's context
    expect(appEmberSatisfies('*')).toBe(false);
  });

  test('macroCondition returns the predicate as-is', function () {
    expect(macroCondition(true)).toBe(true);
    expect(macroCondition(false)).toBe(false);
  });

  test('each returns the array', function () {
    let arr = [1, 2, 3];
    expect(each(arr)).toBe(arr);
  });

  test('each throws for non-array', function () {
    expect(() => each('not an array' as any)).toThrow(Error);
    expect(() => each('not an array' as any)).toThrow('the argument to the each() macro must be an array');
  });

  test('importSync can require a module', function () {
    let result = importSync('path') as { join: Function };
    expect(typeof result.join).toBe('function');
  });

  test('getConfig returns undefined', function () {
    expect(getConfig('some-package')).toBeUndefined();
  });

  test('getOwnConfig returns undefined', function () {
    expect(getOwnConfig()).toBeUndefined();
  });

  test('getGlobalConfig returns an object', function () {
    expect(typeof getGlobalConfig()).toBe('object');
  });

  test('isDevelopingApp returns boolean', function () {
    expect(typeof isDevelopingApp()).toBe('boolean');
  });

  test('isDevelopingApp returns false when EMBER_ENV is production', function () {
    let orig = process.env['EMBER_ENV'];
    process.env['EMBER_ENV'] = 'production';
    try {
      expect(isDevelopingApp()).toBe(false);
    } finally {
      if (orig === undefined) {
        delete process.env['EMBER_ENV'];
      } else {
        process.env['EMBER_ENV'] = orig;
      }
    }
  });

  test('isDevelopingApp returns true when EMBER_ENV is not production', function () {
    let orig = process.env['EMBER_ENV'];
    process.env['EMBER_ENV'] = 'development';
    try {
      expect(isDevelopingApp()).toBe(true);
    } finally {
      if (orig === undefined) {
        delete process.env['EMBER_ENV'];
      } else {
        process.env['EMBER_ENV'] = orig;
      }
    }
  });

  test('isTesting returns false by default', function () {
    let orig = process.env['EMBER_ENV'];
    delete process.env['EMBER_ENV'];
    try {
      expect(isTesting()).toBe(false);
    } finally {
      if (orig !== undefined) {
        process.env['EMBER_ENV'] = orig;
      }
    }
  });

  test('isTesting returns true when EMBER_ENV is test', function () {
    let orig = process.env['EMBER_ENV'];
    process.env['EMBER_ENV'] = 'test';
    try {
      expect(isTesting()).toBe(true);
    } finally {
      if (orig === undefined) {
        delete process.env['EMBER_ENV'];
      } else {
        process.env['EMBER_ENV'] = orig;
      }
    }
  });

  test('failBuild throws an error with the message', function () {
    expect(() => failBuild('something went wrong')).toThrow('something went wrong');
  });

  test('moduleExists returns true for an existing package', function () {
    expect(moduleExists('semver')).toBe(true);
  });

  test('moduleExists returns false for a non-existent package', function () {
    expect(moduleExists('this-package-definitely-does-not-exist-xyz')).toBe(false);
  });
});
