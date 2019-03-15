'use strict';

const EmberApp = require('ember-cli/lib/broccoli/ember-app');
const { MacrosConfig } = require('@embroider/macros');

module.exports = function(defaults) {
  let app = new EmberApp(defaults, {
  });

  MacrosConfig.shared().setOwnConfig(__filename, {
    isClassic: Boolean(process.env.CLASSIC)
  });

  if (process.env.CLASSIC) {
    return app.toTree();
  }

  const Webpack = require('@embroider/webpack').Webpack;
  return require('@embroider/compat').compatBuild(app, Webpack, {
    staticAddonTestSupportTrees: true,
    staticAddonTrees: true,
    staticComponents: true,
    staticHelpers: true
  });
};
