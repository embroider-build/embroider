'use strict';

const EmberApp = require('ember-cli/lib/broccoli/ember-app');
const { prebuild } = require('@embroider/compat');

module.exports = function (defaults) {
  let app = new EmberApp(defaults, {});

  return prebuild(app);
};
