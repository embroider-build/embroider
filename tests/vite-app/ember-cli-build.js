'use strict';

const EmberApp = require('ember-cli/lib/broccoli/ember-app');
const { prebuild } = require('@embroider/compat');

const { maybeEmbroider } = require('@embroider/test-setup');

module.exports = function (defaults) {
  const app = new EmberApp(defaults, {
    // Add options here
  });

  return maybeEmbroider(app);

  // TODO provide a build from vite that almost does maybeEmbroider
  // note: this is to handle ember build and NOT ember serve
  // TODO figure out a way to error on ember serve
  // return emberBuild(app);
};
