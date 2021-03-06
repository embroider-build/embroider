/* eslint-env node */
'use strict';

const EngineAddon = require('ember-engines/lib/engine-addon');

module.exports = EngineAddon.extend({
  name: 'lazy-in-repo-engine',

  lazyLoading: Object.freeze({
    enabled: true,
  }),
});
