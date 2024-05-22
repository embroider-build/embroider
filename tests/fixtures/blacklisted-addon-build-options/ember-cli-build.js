'use strict';

const EmberApp = require('ember-cli/lib/broccoli/ember-app');
const { maybeEmbroider } = require('@embroider/test-setup');

module.exports = function (defaults) {
  let app = new EmberApp(defaults, {
    addons: {
      exclude: ['blacklisted-in-repo-addon'],
    },
  });

  return maybeEmbroider(app);
};
