import Funnel from 'broccoli-funnel';
import Package from './package';

// const customTreeNames = Object.freeze([
//   'treeFor',
//   'treeForAddon',
//   'treeForAddonTemplates',
//   'treeForAddonTestSupport',
//   'treeForApp',
//   'treeForPublic',
//   'treeForStyles', // TODO
//   'treeForTemplates',
//   'treeForTestSupport', // TODO
//   'treeForVendor', // TODO
// ]);

// Represents the set of active V2 packages that make up a complete application. Addons
// that publish as v2 can merely be discovered, addons that publish as v1 get
// up-compiled. The host application itself also gets compiled into v2 format on
// the fly, so that we can present a complete set of v2 packages as the public
// API forward to our bundling phase.
export default class Packages {
  private builtPackages: Map<string, Package> = new Map();

  constructor(project) {
    // TODO: we need to follow all deps, not just active ones. You can still
    // directly import things out of non-active packages, because we follow
    // node_modules resolution rules and those rules don't care about our notion
    // of active.
    project.addons.forEach(addonInstance => this.addPackage(addonInstance));
  }

  private addPackage(addonInstance) {
    // TODO: check for native v2 and go down a different path

    if (this.builtPackages.has(addonInstance.root)) {
      // TODO: the same addon may be used by multiple different packages, and
      // for a v1 package each consumer may cause it to have different build
      // output, so we could have conflicting needs here. (This doesn't come up
      // for v2 packages, their contents are constant by design, dynamicism is
      // handled elsewhere in the build process.)
      //
      // One easy case (that comes up a lot) is addon that don't have any build
      // output (like ember-cli-htmlbars). Those are not really a big deal
      // because only their runtime impacts matter, and those can still have
      // distinct configs while sharing a single copy of the node module.
      console.log(`TODO: multiple instances of same copy of addon ${addonInstance.pkg.name}`);
    } else {
      this.builtPackages.set(addonInstance.root, Package.fromV1(addonInstance));
      addonInstance.addons.forEach(a => this.addPackage(a));
    }
  }

  // TODO: This is a placeholder for development purposes only.
  dumpTrees() {
    return [...this.builtPackages.values()].map((pkg, index) => new Funnel(pkg.tree, { destDir: `out-${index}` }));
  }
}
