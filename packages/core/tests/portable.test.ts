import { maybeNodeModuleVersion } from '../src/portable';
import { readJSONSync } from 'fs-extra';

const EMBROIDER_CORE_VERSION = readJSONSync('../../package.json').version;

describe('maybeNodeModuleVersion', () => {
  test('it', () => {
    expect(maybeNodeModuleVersion('/dev/null')).toEqual(undefined);
    expect(maybeNodeModuleVersion('/does/not/exist')).toEqual(undefined);
    expect(maybeNodeModuleVersion(__dirname)).toEqual(EMBROIDER_CORE_VERSION);
    expect(maybeNodeModuleVersion(__filename)).toEqual(EMBROIDER_CORE_VERSION);
  });
});

