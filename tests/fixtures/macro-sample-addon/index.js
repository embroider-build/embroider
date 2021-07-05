'use strict';

module.exports = {
  name: require('./package').name,
  options: {
    '@embroider/macros': {
      setOwnConfig: {
        shouldBeOverwritten: 'not overwritten',
        configFromAddonItself: 'this is the addon',
      },
    },
  },
  included(app) {
    app.options.autoRun = false;
    this._super.included.apply(this, arguments);
  },
  contentFor(type, config, contents) {
    if (type === 'config-module') {
      const originalContents = contents.join('');
      contents.splice(0, contents.length);
      contents.push(
        'let config = function() {' + originalContents + '}()',
        "config.default.APP.fromConfigModule = 'hello new world';",
        'return config;'
      );
      return;
    }

    if (type === 'app-boot') {
      let appSuffix = 'app';
      let prefix = config.modulePrefix;
      let configAppAsString = JSON.stringify(config.APP || {});
      return [
        'if (!runningTests) {',
        "  require('{{MODULE_PREFIX}}/" + appSuffix + "')['default'].create({{CONFIG_APP}});",
        '}',
        'window.LoadedFromCustomAppBoot = true',
      ]
        .join('\n')
        .replace(/\{\{MODULE_PREFIX\}\}/g, prefix)
        .replace(/\{\{CONFIG_APP\}\}/g, configAppAsString);
    }
  },
};
