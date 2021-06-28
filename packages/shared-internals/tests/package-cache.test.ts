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
    let packageCache = new PackageCache();
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
    let packageCache = new PackageCache();
    packageCache.ownerOfFile(join(tmpLocation, 'index.js'));
    expect(packageCache.ownerOfFile(join(tmpLocation, 'inner', 'index.js'))!.root).toBe(join(tmpLocation, 'inner'));
  });
});
