import { excludeDotFiles, addCachablePlugin, CACHE_BUSTING_PLUGIN } from '../src/app';

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

describe('cacheable-plugin', function () {
  test('noop', function () {
    const input = {};
    addCachablePlugin(input);
    expect(input).toEqual({});
  });

  test('no plugins', function () {
    const input = { plugins: [] };
    addCachablePlugin(input);
    expect(input).toEqual({ plugins: [] });
  });

  test('some plugins', function () {
    const input = {
      plugins: [__dirname, [__dirname, []], [`${__dirname}/../`, []], __dirname, [__dirname, []]],
    };

    addCachablePlugin(input);

    expect(input).toEqual({
      plugins: [
        __dirname,
        [__dirname, []],
        [`${__dirname}/../`, []],
        __dirname,
        [__dirname, []],

        [
          CACHE_BUSTING_PLUGIN.path,
          {
            plugins: {
              [CACHE_BUSTING_PLUGIN.path]: CACHE_BUSTING_PLUGIN.version,
              [__dirname]: CACHE_BUSTING_PLUGIN.version,
              [`${__dirname}/../`]: CACHE_BUSTING_PLUGIN.version,
            },
          },
        ],
      ],
    });
  });
});
