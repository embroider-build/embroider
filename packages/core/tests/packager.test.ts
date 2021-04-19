import { AppMeta, getAppMeta } from '../src';
import { writeJSONSync } from 'fs-extra';
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
