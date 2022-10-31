'use strict';

const EmberApp = require('ember-cli/lib/broccoli/ember-app');
const { maybeEmbroider } = require('@embroider/test-setup');

module.exports = function (defaults) {
  let app = new EmberApp(defaults, {
    // Add options here
    'ember-cli-babel': {
      enableTypeScriptTransform: true,
    },
  });

  return maybeEmbroider(app, {
    skipBabel: [
      {
        package: 'qunit',
      },
    ],
  });
};
