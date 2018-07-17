import mergeTrees from 'broccoli-merge-trees';
import Funnel from 'broccoli-funnel';
import { UnwatchedDir } from 'broccoli-source';
import { existsSync } from 'fs';
import { join } from 'path';

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
  let rootTree = new UnwatchedDir(addonInstance.root);
  trees.push(new Funnel(rootTree, {
    include: ['package.json'],
    destDir: addonInstance.pkg.name,
  }));

  let mainModule = require(addonInstance.constructor._meta_.modulePath);

  if (customizes(mainModule, 'treeForAddon')) {
    console.log(`TODO: ${addonInstance.name} may have customized treeForAddon`);
  } else {
    if (existsSync(join(addonInstance.root, 'addon'))) {
      // todo: set main in package.json to index.js
      // and synthesize an index.js if there isn't one
      trees.push(new Funnel(rootTree, {
        srcDir: 'addon',
        destDir: addonInstance.pkg.name,
      }));
    }
  }

  return mergeTrees(trees);
}
