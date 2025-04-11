import { maybeNodeModuleVersion } from '../src/portable';
import { readJSONSync } from 'fs-extra';

const EMBROIDER_CORE_VERSION = readJSONSync(`${__dirname}/../../package.json`).version;

describe('maybeNodeModuleVersion', () => {
  test('it', () => {
    expect(() => maybeNodeModuleVersion('/dev/null')).toThrow(/Could not find package.json for '\/dev\/null'/);
    expect(() => maybeNodeModuleVersion('/does/not/exist')).toThrow(
      /Could not find package.json for '\/does\/not\/exist'/
    );
    expect(maybeNodeModuleVersion(__dirname)).toEqual(EMBROIDER_CORE_VERSION);
    expect(maybeNodeModuleVersion(__filename)).toEqual(EMBROIDER_CORE_VERSION);
  });
});
