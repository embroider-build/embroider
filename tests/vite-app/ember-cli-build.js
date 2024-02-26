'use strict';

const EmberApp = require('ember-cli/lib/broccoli/ember-app');
// const { prebuild } = require('@embroider/compat');
const { compatBuild } = require('@embroider/compat');

module.exports = function (defaults) {
  const app = new EmberApp(defaults, {
    // Add options here
  });

  return compatBuild(app, undefined, {
    staticAddonTrees: true,
    staticAddonTestSupportTrees: true,
    staticComponents: true,
    staticHelpers: true,
    staticModifiers: true,
    staticEmberSource: true,
    availableContentForTypes: ['fox'],
    amdCompatibility: {
      es: [],
    },
  });

  // return prebuild(app);
};
