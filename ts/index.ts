import mergeTrees from 'broccoli-merge-trees';
import Funnel from 'broccoli-funnel';
import { UnwatchedDir } from 'broccoli-source';
import { Tree } from 'broccoli-plugin';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import RewritePackageJSON from './rewrite-package-json';
import { sync as pkgUpSync }  from 'pkg-up';

// const customTreeNames = Object.freeze([
//   'treeFor',
//   'treeForAddon',
//   'treeForAddonTemplates',
//   'treeForAddonTestSupport',
//   'treeForApp',
//   'treeForPublic',
//   'treeForStyles',
//   'treeForTemplates',
//   'treeForTestSupport',
//   'treeForVendor',
// ]);

// Represents the set of active V2 packages that make up a complete application. Addons
// that publish as v2 can merely be discovered, addons that publish as v1 get
// up-compiled. The host application itself also gets compiled into v2 format on
// the fly, so that we can present a complete set of v2 packages as the public
// API forward to our bundling phase.
export default class Packages {
  private builtPackages: Map<string, Tree> = new Map();

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
    } else {
      this.builtPackages.set(addonInstance.root, this.upcompileV1Package(addonInstance));
      addonInstance.addons.forEach(a => this.addPackage(a));
    }
  }

  upcompileV1Package(addonInstance) {
    let trees = [];

    // addonInstance.root gets modified by a customized "main" or
    // "ember-addon.main" in package.json. We want the real package root here (the
    // place where package.json lives).
    let root = dirname(pkgUpSync(addonInstance.root));

    let rootTree = new UnwatchedDir(root);
    trees.push(new RewritePackageJSON(rootTree));

    let mainModule = require(addonInstance.constructor._meta_.modulePath);

    if (customizes(mainModule, 'treeForAddon', 'treeForAddonTemplates')) {
      console.log(`TODO: ${addonInstance.name} may have customized the addon tree`);
    } else {
      if (existsSync(join(root, 'addon'))) {
        // TODO: set main in package.json to index.js
        // and synthesize an index.js if there isn't one
        trees.push(
          transpile(addonInstance, new Funnel(rootTree, {
            srcDir: 'addon'
          }))
        );
      }
    }

    if (customizes(mainModule, 'treeForAddonTestSupport')) {
      console.log(`TODO: ${addonInstance.name} may have customized the addon test support tree`);
    } else {
      if (existsSync(join(root, 'addon-test-support'))) {
        trees.push(
          transpile(addonInstance, new Funnel(rootTree, {
            srcDir: 'addon-test-support',
            destDir: 'test-support'
          }))
      );
      }
    }

    return new Funnel(mergeTrees(trees), {
      destDir: addonInstance.pkg.name
    });
  }

  // TODO: This is a placeholder for development purposes only.
  dumpTrees() {
    return [...this.builtPackages.values()].map((tree, index) => new Funnel(tree, { destDir: `out-${index}` });
  }
}

function customizes(mainModule, ...treeNames) {
  return mainModule.treeFor || treeNames.find(treeName => mainModule[treeName]);
}

function transpile(_addonInstance, tree) {
  // TODO: for Javascript, this should respect the addon's configured babel
  // plugins but only target ES latest, leaving everything else (especially
  // modules) intact. For templates, this should apply custom AST transforms and
  // re-serialize.
  //
  // Both of these steps can be optimized away when we see there is are no
  // special preprocessors registered that wouldn't already be handled by the
  // app-wide final babel and/or template compilation.
  return tree;
}

