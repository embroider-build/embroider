'use strict';

const EmberApp = require('ember-cli/lib/broccoli/ember-app');
const { compatBuild } = require('@embroider/compat');

module.exports = async function (defaults) {
  const { buildOnce } = await import('@embroider/webpack');
  let app = new EmberApp(defaults, {});

  return compatBuild(app, buildOnce);
};
