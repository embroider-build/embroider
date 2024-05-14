'use strict';

const EmberApp = require('ember-cli/lib/broccoli/ember-app');
const { maybeEmbroider } = require('@embroider/test-setup');

module.exports = function (defaults) {
  let app = new EmberApp(defaults, {
    ...(process.env.FORCE_BUILD_TESTS
      ? {
          tests: true,
        }
      : undefined),
  });

  return maybeEmbroider(app, {
    skipBabel: [
      {
        package: 'qunit',
      },
    ],
  });
};
