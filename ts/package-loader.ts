import AddonPackage from './addon-package';
import { todo } from './messages';

export default class PackageLoader {
  packages: Map<string, AddonPackage> = new Map();

  addPackage(addonInstance) {
    // TODO: check for native v2 and go down a different path

    if (addonInstance.pkg.name === 'ember-auto-import') {
      // auto import is effectively a polyfill for us. We are doing what it does.
      return;
    }

    if (this.packages.has(addonInstance.root)) {
      // TODO: the same addon may be used by multiple different packages, and
      // for a v1 package each consumer may cause it to have different build
      // output, so we could have conflicting needs here. (This doesn't come up
      // for v2 packages, their contents are constant by design, dynamicism is
      // handled elsewhere in the build process.)
      if (this.packages.get(addonInstance.root).hasAnyTrees()) {
        todo(`TODO: multiple instances of same copy of addon ${addonInstance.pkg.name}`);
      } else {
        // This kind of conflict doesn't matter when you don't have any build
        // output. An example of this is ember-cli-htmlbars, which only exists
        // to be a preprocessor.
      }
    } else {
      this.packages.set(addonInstance.root, new AddonPackage(addonInstance));
      addonInstance.addons.forEach(a => this.addPackage(a));
    }
  }

}
