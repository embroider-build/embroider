import { AppMeta, getAppMeta, getPackagerCacheDir } from '../src';
import { tmpdir } from 'os';
import { writeJSONSync, realpathSync } from 'fs-extra';
import { join } from 'path';
import * as tmp from 'tmp';

tmp.setGracefulCleanup();

describe('getAppMeta', () => {
  let name: string, removeCallback: tmp.DirResult['removeCallback'];

  beforeEach(() => {
    ({ name, removeCallback } = tmp.dirSync());

    writeJSONSync(join(name, 'package.json'), {
      'ember-addon': {
        version: 2,
        type: 'app',
        'auto-upgraded': true,
      },
    });
  });

  afterEach(() => {
    removeCallback();
  });

  test('reading the app metadata from a package', () => {
    const meta: AppMeta = getAppMeta(name);
    expect(meta).toMatchObject({
      version: 2,
      type: 'app',
      'auto-upgraded': true,
    });
  });
});

describe('getPackagerCacheDir', () => {
  test('getting the path to a cache directory', () => {
    const cacheDir = getPackagerCacheDir('foo');
    expect(cacheDir).toBe(join(realpathSync(tmpdir()), 'embroider', 'foo'));
  });
});
