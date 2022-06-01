// Some addons need to transform their templates before they have a portable format.
// In "classic" builds this was done by the application.In embroider it should be
// done during the addon build.
const someAstTransformPlugin = require('./some-ast-transform-plugin');

module.exports = {
  plugins: [
    '@embroider/addon-dev/template-colocation-plugin',
    [
      '@embroider/addon-dev/template-transform-plugin',
      {
        astTransforms: [
          someAstTransformPlugin,
          './path/to/another-template-transform-plugin',
        ],
        compilerPath: require.resolve(
          'ember-source/dist/ember-template-compiler'
        ),
      },
    ],
    ['@babel/plugin-proposal-decorators', { legacy: true }],
    '@babel/plugin-proposal-class-properties',
  ],
};
