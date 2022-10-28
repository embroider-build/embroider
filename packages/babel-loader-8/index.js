const { applyVariantToBabelConfig } = require('@embroider/core');
module.exports = require('babel-loader').custom(babel => {
  return {
    customOptions({ variant, appBabelConfigPath, ...extraOptions }) {
      const custom = {
        variant,
        appBabelConfigPath,
      };

      const appBabelConfig = applyVariantToBabelConfig(variant, require(appBabelConfigPath));

      const loader = {
        ...appBabelConfig,
        ...extraOptions,
      };

      if (loader.plugins) {
        loader.plugins = loader.plugins.slice();
      } else {
        loader.plugins = [];
      }

      return {
        custom,
        loader,
      };
    },
  };
});

function pluginMatches(pattern) {
  return function (plugin) {
    return plugin && pattern.test(Array.isArray(plugin) ? plugin[0] : plugin);
  };
}
