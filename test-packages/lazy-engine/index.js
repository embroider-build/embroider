'use strict';

const EngineAddon = require('ember-engines/lib/engine-addon');

module.exports = EngineAddon.extend({
  name: require('./package').name,
  // eslint-disable-next-line ember/avoid-leaking-state-in-ember-objects
  lazyLoading: {
    enabled: true,
  },
});
