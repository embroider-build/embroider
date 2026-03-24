import { optimizeDeps } from '../src/optimize-deps';

describe('optimizeDeps', function () {
  test('should produce default output when invoked without arguments', function () {
    const actual = optimizeDeps();

    const expected = {
      exclude: ['@embroider/macros'],
    };

    expect(actual).toEqual(expected);
  });
});
