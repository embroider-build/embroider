import { optimizeDeps } from '../src/optimize-deps.js';

describe('optimizeDeps', function () {
  test('should produce default output when invoked without arguments', function () {
    const actual = optimizeDeps();

    expect(actual).toMatchInlineSnapshot(
      {
        esbuildOptions: {
          plugins: [expect.any(Object)],
        },
      },
      `
      {
        "esbuildOptions": {
          "plugins": [
            Any<Object>,
          ],
        },
        "exclude": [
          "@embroider/macros",
        ],
        "extensions": [
          ".hbs",
          ".gjs",
          ".gts",
        ],
      }
    `
    );
  });
});
