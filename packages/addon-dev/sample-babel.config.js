// Some addons need to transform their templates before they have a portable format.
// In "classic" builds this was done at the application. In embroider it should
// be done during the addon build.
const someAstTransformPlugin = require('./some-ast-transform-plugin');

module.exports = {
  plugins: [
    '@embroider/addon-dev/template-colocation-plugin',
    [
      'babel-plugin-ember-template-compilation',
      {
        targetFormat: 'hbs',
        compilerPath: 'ember-source/dist/ember-template-compiler.js',
        transforms: [
          someAstTransformPlugin,
          './path/to/another-template-transform-plugin',
        ],
      },
    ],
    ['@babel/plugin-proposal-decorators', { legacy: true }],
    '@babel/plugin-transform-class-properties',
  ],
};
