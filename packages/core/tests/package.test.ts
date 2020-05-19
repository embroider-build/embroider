import Package from '../src/package';
import PackageCache from '../src/package-cache';
import tmp from 'tmp';
import fixturify from 'fixturify';

tmp.setGracefulCleanup();

describe('package', () => {
  test('it respects BROCCOLI_ENABLED_MEMOIZE for mayRebuild method', () => {
    let { name: tmpLocation } = tmp.dirSync();
    let projectJSON = {
      'package.json': JSON.stringify({
        name: 'foobar-web',
      }),
    };

    fixturify.writeSync(tmpLocation, projectJSON);

    let packageCache = new PackageCache();
    let packageInstance = new Package(tmpLocation, packageCache);

    let originalProcessValue = process.env['BROCCOLI_ENABLED_MEMOIZE'];
    process.env['BROCCOLI_ENABLED_MEMOIZE'] = 'true';

    expect(packageInstance.mayRebuild).toBe(true);

    process.env['BROCCOLI_ENABLED_MEMOIZE'] = 'false';
    expect(packageInstance.mayRebuild).toBe(false);

    delete process.env['BROCCOLI_ENABLED_MEMOIZE'];
    expect(packageInstance.mayRebuild).toBe(false);

    process.env['BROCCOLI_ENABLED_MEMOIZE'] = originalProcessValue;
  });

  test('it does not include invalid addons that are listed via paths', () => {
    let { name: tmpLocation } = tmp.dirSync();
    let projectJSON = {
      'package.json': JSON.stringify({
        name: 'foobar-web',
        'ember-addon': {
          paths: ['lib/invalid', 'lib/no-package', 'lib/package-error', 'lib/missing-main', 'lib/good'],
        },
      }),
      lib: {
        'no-package': {},
        'package-error': {
          'package.json': 'not-json',
        },
        'missing-main': {
          'package.json': JSON.stringify({ name: 'missing-main' }),
        },
        good: {
          'package.json': JSON.stringify({ name: 'good', main: 'index.js' }),
          'index.js': '',
        },
      },
    };

    fixturify.writeSync(tmpLocation, projectJSON);

    let packageCache = new PackageCache();
    let packageInstance = new Package(tmpLocation, packageCache);
    let nonResolvableDeps = packageInstance.nonResolvableDeps;

    if (!nonResolvableDeps) {
      // this is to get around the type error of nonResolvable being undefined
      expect(true).toBe(false);
    } else {
      expect(nonResolvableDeps.size).toBe(1);
      expect(nonResolvableDeps.get('good')).toBeTruthy();
    }
  });
});
