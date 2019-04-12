'use strict';

const EmberApp = require('ember-cli/lib/broccoli/ember-app');

module.exports = function(defaults) {
  let app = new EmberApp(defaults, {
    '@embroider/macros': {
      setOwnConfig: {
        mode: 'amazing',
        count: 42,
        inner: {
          items: [{ name: 'Arthur', awesome: true }],
          description: null,
        },
      },
      setConfig: {
        'ember-source': {
          color: 'orange',
        },
        'macro-sample-addon': {
          configFromMacrosTests: 'exists',
        },
      },
    },
  });

  if (process.env.CLASSIC) {
    return app.toTree();
  }

  const Webpack = require('@embroider/webpack').Webpack;
  return require('@embroider/compat').compatBuild(app, Webpack);
};
