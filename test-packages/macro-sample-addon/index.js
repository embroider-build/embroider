'use strict';

module.exports = {
  name: require('./package').name,
  options: {
    '@embroider/macros': {
      setOwnConfig: {
        hello: 'world'
      }
    }
  },
  contentFor(type, config, contents) {
    if (type === 'config-module') {
      const originalContents = contents.join('');
      contents.splice(0, contents.length);
      contents.push(
        'let config = function() {' + originalContents + '}()',
        'config.default.APP.fromConfigModule = \'hello new world\';',
        'return config;'
      );
      return;
    }
  }
};