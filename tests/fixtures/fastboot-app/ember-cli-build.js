'use strict';

const EmberApp = require('ember-cli/lib/broccoli/ember-app');

module.exports = function (defaults) {
  let app = new EmberApp(defaults, {});

  const Webpack = require('@embroider/webpack').Webpack;
  return require('@embroider/compat').compatBuild(app, Webpack, {
    skipBabel: [
      {
        package: 'qunit',
      },
    ],
    packagerOptions: {
      webpackConfig: {
        optimization: {
          splitChunks: {
            // In these tests we want to guarantee that the lazily imported
            // things really get handled lazily by webpack, even if they're too
            // small for the optimizer to normally bother with
            minSize: 1,
          },
        },
      },
    },
  });
};
