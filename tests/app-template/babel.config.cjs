// eslint-disable-next-line n/no-missing-require
const { loadLegacyPlugins } = require("@embroider/compat");

module.exports = {
  babelrc: false,
  highlightCode: false,
  plugins: [
    // Spread plugins coming from classic (v1) addons
    ...loadLegacyPlugins(),
  ],
};
