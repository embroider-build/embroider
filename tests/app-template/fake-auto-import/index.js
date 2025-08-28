'use strict';

const { AutoImport } = require('./auto-import');

module.exports = {
  name: 'ember-auto-import',
  init(...args) {
    this._super.init.apply(this, args);
    AutoImport.register(this);
  },
  included(...args) {
    this._super.included.apply(this, ...args);
    AutoImport.lookup(this).included(this);
  },
  // this exists to be called by @embroider/addon-shim
  registerV2Addon(packageName, packageRoot) {
    AutoImport
      .lookup(this)
      .registerV2Addon(packageName, packageRoot);
  },
  // this exists to be called by @embroider/addon-shim
  leader() {
    return AutoImport.lookup(this);
  },
};
