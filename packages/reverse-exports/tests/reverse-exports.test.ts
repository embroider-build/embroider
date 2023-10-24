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
});
