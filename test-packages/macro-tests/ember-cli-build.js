'use strict';

const EmberApp = require('ember-cli/lib/broccoli/ember-app');

module.exports = function(defaults) {
  let app = new EmberApp(defaults, {
    '@embroider/macros': {
      setOwnConfig: {
        mode: 'amazing',
        count: 42,
        inner: {
          items: [
            { name: 'Arthur', awesome: true }
          ],
          description: null
        }
      },
      setConfig: {
        'ember-source': {
          color: 'orange'
        },
        'macro-sample-addon': {
          configFromMacrosTests: 'exists'
        }
      }
    }
  });

  app.import('vendor/apple.js', {
    using: [
      { transformation: 'amd', as: 'amd'}
    ],
    outputFile: 'apple.js'
  })


  app.import('vendor/four.js', { outputFile: 'ordered.js' });
  app.import('vendor/two.js', { outputFile: 'ordered.js' });
  app.import('vendor/three.js', { outputFile: 'ordered.js' });
  app.import('vendor/one.js', { outputFile: 'ordered.js' });

  if (process.env.CLASSIC) {
    return app.toTree();
  }

  const Webpack = require('@embroider/webpack').Webpack;
  return require('@embroider/compat').compatBuild(app, Webpack);
};
