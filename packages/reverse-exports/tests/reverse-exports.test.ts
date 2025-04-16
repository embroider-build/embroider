import { externalName, _findPathRecursively, _prepareStringForRegex } from '../src/index.js';

describe('reverse exports', function () {
  it('exports is missing', function () {
    expect(externalName({ name: 'best-addon' }, './dist/_app_/components/face.js')).toBe(
      'best-addon/dist/_app_/components/face.js'
    );
  });

  it('exports is a string', function () {
    const actual = externalName(
      {
        name: 'my-addon',
        exports: './foo.js',
      },
      './foo.js'
    );
    expect(actual).toBe('my-addon');
  });

  it('exports is an object with one entry', function () {
    const actual = externalName(
      {
        name: 'my-addon',
        exports: {
          '.': './foo.js',
        },
      },
      './foo.js'
    );
    expect(actual).toBe('my-addon');
  });

  it('subpath exports', function () {
    const packageJson = {
      name: 'my-addon',
      exports: {
        '.': './main.js',
        './sub/path': './secondary.js',
        './prefix/': './directory/',
        './prefix/deep/': './other-directory/',
        './other-prefix/*': './yet-another/*/*.js',
        './glob/*': './grod/**/*.js',
      },
    };
    expect(externalName(packageJson, './main.js')).toBe('my-addon');
    expect(externalName(packageJson, './secondary.js')).toBe('my-addon/sub/path');
    expect(externalName(packageJson, './directory/some/file.js')).toBe('my-addon/prefix/some/file.js');
    expect(externalName(packageJson, './other-directory/file.js')).toBe('my-addon/prefix/deep/file.js');
    expect(externalName(packageJson, './yet-another/deep/file.js')).toBe('my-addon/other-prefix/deep/file');
    expect(externalName(packageJson, './grod/very/deep/file.js')).toBe('my-addon/glob/very/deep/file');
  });

  it('alternative exports', function () {
    const packageJson = {
      name: 'my-addon',
      exports: {
        './things/': ['./good-things/', './bad-things/'],
      },
    };
    expect(externalName(packageJson, './good-things/apple.js')).toBe('my-addon/things/apple.js');
    expect(externalName(packageJson, './bad-things/apple.js')).toBe('my-addon/things/apple.js');
  });

  it('conditional exports - simple abbreviated', function () {
    const packageJson = {
      name: 'my-addon',
      exports: {
        import: './index-module.js',
        require: './index-require.cjs',
        default: './index.js',
      },
    };
    expect(externalName(packageJson, './index-module.js')).toBe('my-addon');
    expect(externalName(packageJson, './index-require.cjs')).toBe('my-addon');
    expect(externalName(packageJson, './index.js')).toBe('my-addon');
  });

  it('conditional exports - simple non-abbreviated', function () {
    const packageJson = {
      name: 'my-addon',
      exports: {
        '.': {
          import: './index-module.js',
          require: './index-require.cjs',
          default: './index.js',
        },
      },
    };
    expect(externalName(packageJson, './index-module.js')).toBe('my-addon');
    expect(externalName(packageJson, './index-require.cjs')).toBe('my-addon');
    expect(externalName(packageJson, './index.js')).toBe('my-addon');
  });

  it('conditional subpath exports', function () {
    const packageJson = {
      name: 'my-addon',
      exports: {
        '.': './index.js',
        './feature.js': {
          node: './feature-node.cjs',
          default: './feature.js',
        },
      },
    };
    expect(externalName(packageJson, './index.js')).toBe('my-addon');
    expect(externalName(packageJson, './feature-node.cjs')).toBe('my-addon/feature.js');
    expect(externalName(packageJson, './feature.js')).toBe('my-addon/feature.js');
  });

  it('nested conditional exports', function () {
    const packageJson = {
      name: 'my-addon',
      exports: {
        node: {
          import: './feature-node.mjs',
          require: './feature-node.cjs',
        },
        default: './feature.mjs',
      },
    };
    expect(externalName(packageJson, './feature-node.mjs')).toBe('my-addon');
    expect(externalName(packageJson, './feature-node.cjs')).toBe('my-addon');
    expect(externalName(packageJson, './feature.mjs')).toBe('my-addon');
  });

  it('should return undefined when no exports entry is matching', function () {
    const packageJson = {
      name: 'my-addon',
      exports: {
        node: {
          import: './feature-node.mjs',
          require: './feature-node.cjs',
        },
        default: './feature.mjs',
      },
    };

    expect(externalName(packageJson, './foo.bar')).toBe(undefined);
  });

  it('conditional exports: using a single asterisk as glob for nested path', function () {
    const packageJson = {
      name: 'my-v2-addon',
      exports: {
        '.': './dist/index.js',
        './*': {
          types: './dist/*.d.ts',
          default: './dist/*.js',
        },
        './addon-main.js': './addon-main.js',
      },
    };

    expect(externalName(packageJson, './dist/_app_/components/welcome-page.js')).toBe(
      'my-v2-addon/_app_/components/welcome-page'
    );
  });
});

describe('_findKeyRecursively', function () {
  it('Returns "." when string is provided and matcher is matching', function () {
    expect(_findPathRecursively('foo', str => str === 'foo')).toStrictEqual({ key: '.', value: 'foo' });
  });

  it('Returns undefined when string is provided and matcher is not matching', function () {
    expect(_findPathRecursively('foo', str => str === 'bar')).toBe(undefined);
  });

  it('Returns "." when array is provided and matcher is matching', function () {
    expect(_findPathRecursively(['foo', 'bar'], str => str === 'bar')).toStrictEqual({ key: '.', value: 'bar' });
  });

  it('Returns undefined when array is provided and matcher is not matching', function () {
    expect(_findPathRecursively(['foo', 'bar'], str => str === 'baz')).toBe(undefined);
  });

  it('Returns a matching key when a record of valid paths is provided and matcher is matching', function () {
    const exports = {
      '.': './main.js',
      './sub/path': './secondary.js',
      './prefix/': './directory/',
      './prefix/deep/': './other-directory/',
      './other-prefix/*': './yet-another/*/*.js',
      './glob/*': './grod/**/*.js',
    };

    expect(_findPathRecursively(exports, str => str === './secondary.js')).toStrictEqual({
      key: './sub/path',
      value: './secondary.js',
    });
  });

  it('Returns undefined when a record of valid paths is provided and matcher is not matching', function () {
    const exports = {
      '.': './main.js',
      './sub/path': './secondary.js',
      './prefix/': './directory/',
      './prefix/deep/': './other-directory/',
      './other-prefix/*': './yet-another/*/*.js',
      './glob/*': './grod/**/*.js',
    };

    expect(_findPathRecursively(exports, str => str === './non-existent-path')).toBe(undefined);
  });

  it('Returns a matching key when a record of arrays is provided and matcher is matching', function () {
    const exports = {
      './foo': ['./bar', './baz'],
      './zomg': ['./lol', './wtf'],
    };

    expect(_findPathRecursively(exports, str => str === './lol')).toStrictEqual({ key: './zomg', value: './lol' });
  });

  it('Returns undefined when a record of arrays is provided and matcher is not matching', function () {
    const exports = {
      './foo': ['./bar', './baz'],
      './zomg': ['./lol', './wtf'],
    };

    expect(_findPathRecursively(exports, str => str === './rofl')).toBe(undefined);
  });

  it('Returns a matching key when a record of conditions with paths is provided and matcher is matching', function () {
    const exports = {
      '.': './index.js',
      './feature.js': {
        node: './feature-node.js',
        default: './feature.js',
      },
    };

    expect(_findPathRecursively(exports, str => str === './feature-node.js')).toStrictEqual({
      key: './feature.js',
      value: './feature-node.js',
    });
  });

  it('Returns undefined when a record of conditions with paths is provided and matcher is not matching', function () {
    const exports = {
      '.': './index.js',
      './feature.js': {
        node: './feature-node.js',
        default: './feature.js',
      },
    };

    expect(_findPathRecursively(exports, str => str === './missing-path.js')).toBe(undefined);
  });

  it('Returns a matching key when a record of conditions withithout paths is provided and matcher is matching', function () {
    const exports = {
      node: {
        import: './feature-node.mjs',
        require: './feature-node.cjs',
      },
      default: './feature.mjs',
    };

    expect(_findPathRecursively(exports, str => str === './feature-node.cjs')).toStrictEqual({
      key: '.',
      value: './feature-node.cjs',
    });
  });

  it('Returns undefined when a record of conditions without paths is provided and matcher is not matching', function () {
    const exports = {
      node: {
        import: './feature-node.mjs',
        require: './feature-node.cjs',
      },
      default: './feature.mjs',
    };

    expect(_findPathRecursively(exports, str => str === './missing-path.js')).toBe(undefined);
  });
});

describe('_prepareStringForRegex', function () {
  [
    { input: './foo', expected: '^\\.\\/foo$' },
    { input: './foo.js', expected: '^\\.\\/foo\\.js$' },
    { input: './foo/*.js', expected: '^\\.\\/foo\\/.*\\.js$' },
    { input: './foo/', expected: '^\\.\\/foo\\/.*$' },
  ].forEach(({ input, expected }) => {
    it(input, function () {
      expect(_prepareStringForRegex(input)).toStrictEqual(expected);
    });
  });
});
