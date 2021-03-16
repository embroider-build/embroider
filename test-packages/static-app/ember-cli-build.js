'use strict';

const EmberApp = require('ember-cli/lib/broccoli/ember-app');
const { MacrosConfig } = require('@embroider/macros/src/node');

module.exports = function (defaults) {
  let app = new EmberApp(defaults, {});

  MacrosConfig.for(app).setOwnConfig(__filename, {
    isClassic: Boolean(process.env.CLASSIC),
  });

  if (process.env.CLASSIC) {
    return app.toTree();
  }

  const Webpack = require('@embroider/webpack').Webpack;
  return require('@embroider/compat').compatBuild(app, Webpack, {
    workspaceDir: process.env.WORKSPACE_DIR,
    staticAddonTestSupportTrees: true,
    staticAddonTrees: true,
    staticComponents: true,
    staticHelpers: true,
    skipBabel: [
      {
        package: 'qunit',
        semver: '*',
      },
    ],
    packageRules: [
      {
        package: 'static-app',
        appModules: {
          'components/fancy-box.js': {
            dependsOnComponents: ['{{default-title}}'],
          },
        },
        components: {
          '{{fancy-box}}': {
            acceptsComponentArguments: [{ name: 'titleComponent', becomes: 'this.titleComponentWithDefault' }],
          },
        },
      },
    ],
  });
};
