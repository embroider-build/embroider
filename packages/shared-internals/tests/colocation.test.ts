import { syntheticJStoHBS } from '../src';

describe('colocation utils', function () {
  describe('syntheticJStoHBS', function () {
    test('it returns .hbs files for .js', function () {
      const testCases = [
        ['foo.js', 'foo.hbs'],
        ['foo.js?qp', 'foo.hbs?qp'],
        ['foo/json.js', 'foo/json.hbs'],
      ];

      for (const [from, to] of testCases) {
        expect(syntheticJStoHBS(from)).toEqual(to);
      }
    });

    test('it ignores non .js files', function () {
      const testCases = ['foo.ts', 'foo.hbs', 'foo.js.xxx'];

      for (const from of testCases) {
        expect(syntheticJStoHBS(from)).toEqual(null);
      }
    });
  });
});
