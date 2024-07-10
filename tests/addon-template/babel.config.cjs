// eslint-disable-next-line n/no-missing-require
const { loadLegacyPlugins, loadPluginDebugMacros } = require("@embroider/compat");

module.exports = {
  babelrc: false,
  highlightCode: false,
  plugins: [
    // Spread plugins coming from classic (v1) addons
    ...loadLegacyPlugins(),
    ["@babel/plugin-proposal-decorators", { legacy: true }],
    ["@babel/plugin-transform-private-property-in-object", { loose: false }],
    ["@babel/plugin-transform-private-methods", { loose: false }],
    ["@babel/plugin-transform-class-properties", { loose: false }],
    ...loadPluginDebugMacros(),
  ],
  presets: [
    [
      "@babel/preset-env",
      {
        modules: false,
        targets: {
          browsers: [
            "last 1 Chrome versions",
            "last 1 Firefox versions",
            "last 1 Safari versions",
          ],
        },
      },
    ],
  ],
};
