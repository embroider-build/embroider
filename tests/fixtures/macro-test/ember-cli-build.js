'use strict';

const EmberApp = require('ember-cli/lib/broccoli/ember-app');
const { maybeEmbroider } = require('@embroider/test-setup');

module.exports = function (defaults) {
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
          shouldBeOverwritten: 'overwritten',
        },
      },
    },
  });

  app.import('vendor/apple.js', {
    using: [{ transformation: 'amd', as: 'amd' }],
    outputFile: 'apple.js',
  });

  app.import('vendor/four.js', { outputFile: 'ordered.js' });
  app.import('vendor/two.js', { outputFile: 'ordered.js' });
  app.import('vendor/three.js', { outputFile: 'ordered.js' });
  app.import('vendor/one.js', { outputFile: 'ordered.js' });

  app.import('vendor/prepend/one.js', { prepend: true });
  app.import('vendor/prepend/two.js', { prepend: true });
  app.import('vendor/prepend/three.js', { prepend: true });
  app.import('vendor/prepend/four.js', { prepend: true });
  app.import('vendor/prepend/order.js', { prepend: true });

  return maybeEmbroider(app);
};
