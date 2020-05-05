'use strict';

module.exports = {
  name: require('./package').name,
  updateFastBootManifest(manifest) {
    manifest.vendorFiles.push('fastboot-addon/sample.js');
    return manifest;
  },
};
