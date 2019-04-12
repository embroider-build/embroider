'use strict';

module.exports = {
  name: require('./package').name,
  options: {
    '@embroider/macros': {
      setOwnConfig: {
        hello: 'world',
      },
    },
  },
};
