'use strict';

const EmberApp = require('ember-cli/lib/broccoli/ember-app');

module.exports = function(defaults) {
  let app = new EmberApp(defaults, {
    autoImport: {
      // we have a direct dependency on qunit for use in our fastboot-tests, but
      // for the standard ember tests we don't want to auto-import this, we want
      // to use the copy provided magically by ember-qunit.
      exclude: ['qunit'],
    },
    babel: {
      plugins: [require.resolve('ember-auto-import/babel-plugin')],
    },
  });

  // Use `app.import` to add additional libraries to the generated
  // output files.
  //
  // If you need to use different assets in different
  // environments, specify an object as the first parameter. That
  // object's keys should be the environment name and the values
  // should be the asset to use in that environment.
  //
  // If the library that you are including contains AMD or ES6
  // modules that you would like to import into your application
  // please specify an object with the list of modules as keys
  // along with the exports of each module as its value.

  if (process.env.CLASSIC) {
    return app.toTree();
  }
  const Webpack = require('@embroider/webpack').Webpack;
  return require('@embroider/compat').compatBuild(app, Webpack);
};
