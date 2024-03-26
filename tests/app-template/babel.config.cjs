// eslint-disable-next-line n/no-missing-require

let config;

// TODO - remove this once we have the better solution for injecting stage1 babel config into a real config file
// this is needed because there are things (like ember-composible-helpers) that are now finding our babel config during
// their stage1 build and historically they will never (99% of the time) have found any babel config.
// we might need to keep something like this so that prebuild will never apply babel configs during stage1 i.e. a util
// function that wraps your whole babel config
if (
  process.env.EMBROIDER_PREBUILD ||
  process.env.EMBROIDER_TEST_SETUP_FORCE === "classic"
) {
  config = {};
} else {
  config = require("./node_modules/.embroider/rewritten-app/_babel_config_");
}

module.exports = config;
