'use strict';

module.exports = {
  name: require('./package').name,

  included(...args) {
    this._super.included.apply(this, args);
    this.addons
      .find((a) => a.name === 'ember-auto-import')
      .registerV2Addon(this.parent.name, this.parent.pkg.root);
  },
};
