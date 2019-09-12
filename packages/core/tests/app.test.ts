import 'qunit';
import { excludeDotFiles } from '../src/app';

describe('dot files can be excluded', () => {
  test('excludeDotFiles works', () => {
    expect(excludeDotFiles([])).toEqual([]);
    expect(excludeDotFiles(['.foo.js'])).toEqual([]);
    expect(excludeDotFiles(['bar/.foo.js'])).toEqual([]);
    expect(excludeDotFiles(['.foo.js', 'bar/.foo.js'])).toEqual([]);
    expect(excludeDotFiles(['foo.bar.baz', '.foo.js'])).toEqual(['foo.bar.baz']);
    expect(excludeDotFiles(['foo/bar/baz/.foo.js'])).toEqual([]);
  });
});
