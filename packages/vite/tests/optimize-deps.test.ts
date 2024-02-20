import { optimizeDeps } from '../src/optimize-deps';

describe('optimizeDeps', function () {
  test('should produce default output when invoked without arguments', function () {
    const actual = optimizeDeps();

    expect(actual).toMatchInlineSnapshot(
      {
        esbuildOptions: {
          plugins: [
            {
              name: 'embroider-esbuild-resolver',
              setup: expect.any(Function),
            },
          ],
        },
      },
      `
      {
        "esbuildOptions": {
          "plugins": [
            {
              "name": "embroider-esbuild-resolver",
              "setup": Any<Function>,
            },
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
