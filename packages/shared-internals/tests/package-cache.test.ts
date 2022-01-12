import PackageCache from '../src/package-cache';
import tmp from 'tmp';
import { join } from 'path';
import fixturify from 'fixturify';
import { realpathSync } from 'fs';

tmp.setGracefulCleanup();

describe('package-cache', () => {
  test('it handles nested in-repo packages', () => {
    let { name: tmpLocation } = tmp.dirSync();
    tmpLocation = realpathSync(tmpLocation);

    let projectJSON = {
      'package.json': JSON.stringify({
        name: 'outer',
      }),
      'index.js': '',
      inner: {
        'package.json': JSON.stringify({
          name: 'inner',
        }),
        'index.js': '',
      },
    };
    fixturify.writeSync(tmpLocation, projectJSON);
    let packageCache = new PackageCache(tmpLocation);
    expect(packageCache.ownerOfFile(join(tmpLocation, 'inner', 'index.js'))!.root).toBe(join(tmpLocation, 'inner'));
  });

  test('it handles nested in-repo packages even when the parent is in cache', () => {
    let { name: tmpLocation } = tmp.dirSync();
    tmpLocation = realpathSync(tmpLocation);

    let projectJSON = {
      'package.json': JSON.stringify({
        name: 'outer',
      }),
      'index.js': '',
      inner: {
        'package.json': JSON.stringify({
          name: 'inner',
        }),
        'index.js': '',
      },
    };
    fixturify.writeSync(tmpLocation, projectJSON);
    let packageCache = new PackageCache(tmpLocation);
    packageCache.ownerOfFile(join(tmpLocation, 'index.js'));
    expect(packageCache.ownerOfFile(join(tmpLocation, 'inner', 'index.js'))!.root).toBe(join(tmpLocation, 'inner'));
  });
  test('it handles nested in-repo packages', () => {
    let { name: tmpLocation } = tmp.dirSync();
    tmpLocation = realpathSync(tmpLocation);

    let projectJSON = {
      'package.json': JSON.stringify({
        name: 'outer',
      }),
      'index.js': '',
      inner: {
        'package.json': JSON.stringify({
          name: 'inner',
        }),
        'index.js': '',
      },
    };
    fixturify.writeSync(tmpLocation, projectJSON);
    let packageCache = new PackageCache(tmpLocation);
    expect(packageCache.ownerOfFile(join(tmpLocation, 'inner', 'index.js'))!.root).toBe(join(tmpLocation, 'inner'));
  });

  test('it considers the package dir owned by the package', () => {
    let { name: tmpLocation } = tmp.dirSync();
    tmpLocation = realpathSync(tmpLocation);

    let projectJSON = {
      'package.json': JSON.stringify({
        name: 'outer',
      }),
      'index.js': '',
      inner: {
        'package.json': JSON.stringify({
          name: 'inner',
        }),
        'index.js': '',
      },
    };
    fixturify.writeSync(tmpLocation, projectJSON);
    let packageCache = new PackageCache(tmpLocation);
    expect(packageCache.ownerOfFile(join(tmpLocation, 'inner'))!.root).toBe(join(tmpLocation, 'inner'));
  });
});
