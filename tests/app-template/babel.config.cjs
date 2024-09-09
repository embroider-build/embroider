const {
  transformsFromV1Addons,
  looseModeSupport,
  templateMacros,
  babelMacros,
  adjustImports,
  oldDebugMacros,
  templateColocation,
} = require("@embroider/compat/babel");

module.exports = {
  plugins: [
    [
      "babel-plugin-ember-template-compilation",
      {
        compilerPath: "ember-source/dist/ember-template-compiler.js",
        enableLegacyModules: [
          "ember-cli-htmlbars",
          "ember-cli-htmlbars-inline-precompile",
          "htmlbars-inline-precompile",
        ],
        transforms: [
          ...transformsFromV1Addons(),
          looseModeSupport(),
          ...templateMacros(),
        ],
      },
    ],
    ...babelMacros(),
    [
      "module:decorator-transforms",
      {
        runtime: { import: require.resolve("decorator-transforms/runtime") },
      },
    ],
    [
      "@babel/plugin-transform-runtime",
      {
        absoluteRuntime: __dirname,
        useESModules: true,
        regenerator: false,
      },
    ],
    adjustImports(),
    ...oldDebugMacros(),
    templateColocation(),
  ],
};
