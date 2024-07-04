// eslint-disable-next-line n/no-missing-require
const { loadLegacyPlugins } = require("@embroider/compat");

module.exports = {
  babelrc: false,
  highlightCode: false,
  plugins: [
    // Spread plugins coming from classic (v1) addons
    ...loadLegacyPlugins(),
    ["@babel/plugin-proposal-decorators", { legacy: true }],
    ["@babel/plugin-proposal-private-property-in-object", { loose: false }],
    ["@babel/plugin-proposal-private-methods", { loose: false }],
    ["@babel/plugin-proposal-class-properties", { loose: false }],
    [
      require.resolve("babel-plugin-debug-macros"),
      {
        flags: [
          {
            source: "@glimmer/env",
            flags: {
              DEBUG: true,
              CI: false,
            },
          },
        ],
        debugTools: {
          isDebug: true,
          source: "@ember/debug",
          assertPredicateIndex: 1,
        },
        externalizeHelpers: {
          module: "@ember/debug",
        },
      },
      "@ember/debug stripping",
    ],
    [
      require.resolve("babel-plugin-debug-macros"),
      {
        externalizeHelpers: {
          module: "@ember/application/deprecations",
        },
        debugTools: {
          isDebug: true,
          source: "@ember/application/deprecations",
          assertPredicateIndex: 1,
        },
      },
      "@ember/application/deprecations stripping",
    ],
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
