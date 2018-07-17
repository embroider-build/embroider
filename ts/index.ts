import mergeTrees from 'broccoli-merge-trees';
import Funnel from 'broccoli-funnel';
import { UnwatchedDir } from 'broccoli-source';
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

function customizes(mainModule, treeName) {
  return mainModule.treeFor || mainModule[treeName];
}

export function prebuildV1Package(addonInstance) {
  let trees = [];

  // addonInstance.root gets modified by a customized "main" or
  // "ember-addon.main" in package.json. We want the real package root here (the
  // place where package.json lives).
  let root = dirname(pkgUpSync(addonInstance.root));

  let rootTree = new UnwatchedDir(root);
  trees.push(new RewritePackageJSON(rootTree));

  let mainModule = require(addonInstance.constructor._meta_.modulePath);

  if (customizes(mainModule, 'treeForAddon')) {
    console.log(`TODO: ${addonInstance.name} may have customized treeForAddon`);
  } else {
    if (existsSync(join(root, 'addon'))) {
      // todo: set main in package.json to index.js
      // and synthesize an index.js if there isn't one
      trees.push(new Funnel(rootTree, {
        srcDir: 'addon'
      }));
    }
  }

  return new Funnel(mergeTrees(trees), {
    destDir: addonInstance.pkg.name
  });
}
