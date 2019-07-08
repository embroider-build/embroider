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

  app.import('vendor/prepend/one.js', { prepend: true });
  app.import('vendor/prepend/two.js', { prepend: true });
  app.import('vendor/prepend/three.js', { prepend: true });
  app.import('vendor/prepend/four.js', { prepend: true });

  const HIGHCHARTS_BASE_PATH = 'node_modules/highcharts';
  const highchartsPath = `${HIGHCHARTS_BASE_PATH}/highcharts.src.js`;
  const highchartsAccessibilityPath = `${HIGHCHARTS_BASE_PATH}/modules/accessibility.src.js`;

  app.import(highchartsPath, { outputFile: 'assets/highcharts/highcharts.js' });
  app.import(highchartsAccessibilityPath, { outputFile: 'assets/highcharts/modules/accessibility.js' });

  const HIGHLIGHTJS_BASE_PATH = 'node_modules/highlight.js';
  app.import(`${HIGHLIGHTJS_BASE_PATH}/lib/highlight.js`, {
    outputFile: 'assets/highlight.js/highlight.js',
    using: [
      {
        transformation: 'amd',
        as: 'highlight',
      },
    ],
  });

  app.import(`${HIGHLIGHTJS_BASE_PATH}/lib/languages/json.js`, {
    outputFile: 'assets/highlight.js/languages/json.js',
    using: [
      {
        transformation: 'cjs',
        as: 'highlight-json',
      },
    ],
  });

  if (process.env.CLASSIC) {
    return app.toTree();
  }

  const Webpack = require('@embroider/webpack').Webpack;
  return require('@embroider/compat').compatBuild(app, Webpack);
};
