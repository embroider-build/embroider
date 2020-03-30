import { lexicographically, pushUnique } from '../src/dependency-ordering-utils';

describe('lexicographically', function() {
  it('works', function() {
    expect(['c', 'z/b/z', 'z/b/d', 'z/a/d', 'z/a/c', 'b', 'z/a/d', 'a'].sort(lexicographically)).toEqual([
      'a',
      'b',
      'c',
      'z/a/c',
      'z/a/d',
      'z/a/d',
      'z/b/d',
      'z/b/z',
    ]);
  });
});

describe('pushUnique', function() {
  it('works (and does last write win)', function() {
    let a = 'a';
    let b = 'b';
    let c = 'c';

    let result: string[] = [];
    [a, a, a, b, a, c, a, c].forEach(entry => pushUnique(result, entry));

    expect(result).toEqual([b, a, c]);
  });
});
