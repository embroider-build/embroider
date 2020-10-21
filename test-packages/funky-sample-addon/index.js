'use strict';

const funnel = require('broccoli-funnel');
const mergeTrees = require('broccoli-merge-trees');
const path = require('path');

process.env.EMBER_CLI_IGNORE_ADDON_NAME_MISMATCH = true;
module.exports = {
  name: 'funky-sample-addon',

  treeForAddon() {
    const addonTree = this._super.treeForAddon.apply(this, arguments),
      fakeModuleSrc = __dirname + '/fake-other-module/index.js';

    const fakeModuleTree = funnel(path.dirname(fakeModuleSrc), {
      files: [path.basename(fakeModuleSrc)],
      getDestinationPath() {
        return 'fake-module.js';
      }
    });

    const babelAddon = this.addons.find(
      addon => addon.name === 'ember-cli-babel'
    );

    const modulesArtdeco = funnel(babelAddon.transpileTree(fakeModuleTree), {
      destDir: 'modules'
    });

    return mergeTrees([
      addonTree,
      modulesArtdeco
    ]);
  }
};
