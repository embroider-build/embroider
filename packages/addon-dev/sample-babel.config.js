// Some addons need to transform their templates before they have a portable format.
// In "classic" builds this was done at the application. In embroider it should
// be done during the addon build.
const someAstTransformPlugin = require('./some-ast-transform-plugin');

// The `@embroider/addon-dev/template-transform-plugin` has the following options:
// `options.astTransforms` - an array of functions or paths to preprocess the GlimmerAST
// `options.compilerPath` - Optional: Defaults to `ember-source/dist/ember-template-compiler`

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
      },
    ],
    ['@babel/plugin-proposal-decorators', { legacy: true }],
    '@babel/plugin-proposal-class-properties',
  ],
};
