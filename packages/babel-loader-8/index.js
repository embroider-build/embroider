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

      // webpack uses acorn and acorn doesn't parse these features yet, so we
      // always tranpile them away regardless of what preset-env is doing
      if (!loader.plugins.some(pluginMatches(/@babel\/plugin-proposal-optional-chaining/))) {
        loader.plugins.push(require.resolve('@babel/plugin-proposal-optional-chaining'));
      }
      if (!loader.plugins.some(pluginMatches(/@babel\/plugin-proposal-nullish-coalescing-operator/))) {
        loader.plugins.push(require.resolve('@babel/plugin-proposal-nullish-coalescing-operator'));
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
