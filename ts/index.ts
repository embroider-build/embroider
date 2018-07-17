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

function customizes(mainModule, ...treeNames) {
  return mainModule.treeFor || treeNames.find(treeName => mainModule[treeName]);
}

function transpile(addonInstance, tree) {
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

export function prebuildV1Package(addonInstance) {
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
