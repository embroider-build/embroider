import reversePackageExports from '../src';

describe('reverse exports', function () {
  it('correctly reversed exports', function () {
    // TODO figure out what the result should be if it doesn't match anything in exports
    expect(reversePackageExports({ name: 'best-addon' }, './dist/_app_/components/face.js')).toBe(
      'best-addon/dist/_app_/components/face.js'
    );

    expect(
      reversePackageExports(
        {
          name: 'best-addon',
          exports: {
            './*': './dist/*.js',
          },
        },
        './dist/_app_/components/face.js'
      )
    ).toBe('best-addon/_app_/components/face');
  });

  it('exports is a string', function () {
    const actual = reversePackageExports(
      {
        name: 'my-addon',
        exports: './foo.js',
      },
      './foo.js'
    );

    expect(actual).toBe('my-addon');
  });

  it('exports is an object with one entry', function () {
    const actual = reversePackageExports(
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

    expect(reversePackageExports(packageJson, './main.js')).toBe('my-addon');
    expect(reversePackageExports(packageJson, './secondary.js')).toBe('my-addon/sub/path');
    expect(reversePackageExports(packageJson, './directory/some/file.js')).toBe('my-addon/prefix/some/file.js');
    expect(reversePackageExports(packageJson, './other-directory/file.js')).toBe('addon/prefix/deep/file.js');

    expect(reversePackageExports(packageJson, './yet-another/deep/file.js')).toBe('addon/other-prefix/deep/file');

    expect(reversePackageExports(packageJson, './grod/very/deep/file.js')).toBe('addon/glob/very/deep/file');
  });

  it('alternative exports', function () {
    const packageJson = {
      name: 'my-addon',
      exports: {
        './things/': ['./good-things/', './bad-things/'],
      },
    };

    expect(reversePackageExports(packageJson, './good-things/apple.js')).toBe('my-addon/things/apple.js');
    expect(reversePackageExports(packageJson, './bad-things/apple.js')).toBe('my-addon/things/apple.js');
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

    expect(reversePackageExports(packageJson, './index-module.js')).toBe('my-addon');
    expect(reversePackageExports(packageJson, './index-require.cjs')).toBe('my-addon');
    expect(reversePackageExports(packageJson, './index.js')).toBe('my-addon');
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

    expect(reversePackageExports(packageJson, './index-module.js')).toBe('my-addon');
    expect(reversePackageExports(packageJson, './index-require.cjs')).toBe('my-addon');
    expect(reversePackageExports(packageJson, './index.js')).toBe('my-addon');
  });

  it('conditional subpath exports', function () {
    const packageJson = {
      name: 'my-addon',
      exports: {
        '.': './index.js',
        './feature.js': {
          node: './feature-node.js',
          default: './feature.js',
        },
      },
    };

    expect(reversePackageExports(packageJson, './index.js')).toBe('my-addon');
    expect(reversePackageExports(packageJson, './feature-node.cjs')).toBe('my-addon/feature.js');
    expect(reversePackageExports(packageJson, './feature.js')).toBe('my-addon/feature.js');
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

    expect(reversePackageExports(packageJson, './feature-node.mjs')).toBe('my-addon');
    expect(reversePackageExports(packageJson, './feature-node.cjs')).toBe('my-addon');
    expect(reversePackageExports(packageJson, './feature.mjs')).toBe('my-addon');
  });
});
