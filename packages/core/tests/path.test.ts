import { explicitRelative } from '../src';

describe('core path utils', function() {
  test('explicit relative', function() {
    // when there's no common parts, paths stay absolute
    expect(explicitRelative('/a/b/c', '/d/e/f')).toEqual('/d/e/f');

    // the first arg is always interpreted as a directory, the second as a file,
    // so this is correct answer:
    expect(explicitRelative('/a/b/c', '/a/b/c')).toEqual('../c');

    expect(explicitRelative('/a/b/c', '/a/b/d/e/f.js')).toEqual('../d/e/f.js');
    expect(explicitRelative('/a/b/c', '/a/d/e/f.js')).toEqual('../../d/e/f.js');
    expect(explicitRelative('/a/b/c', '/a/b/c/d.js')).toEqual('./d.js');
  });
});
