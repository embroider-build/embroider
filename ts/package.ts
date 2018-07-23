import mergeTrees from 'broccoli-merge-trees';
import Funnel from 'broccoli-funnel';
import { UnwatchedDir } from 'broccoli-source';
import { Tree } from 'broccoli-plugin';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import RewritePackageJSON from './rewrite-package-json';
import { sync as pkgUpSync }  from 'pkg-up';

// represents a v2 package
export default class Package {
  static fromV1(addonInstance) : Package {
    return new this(addonInstance);
  }

  private constructor(private addonInstance) {}

  get tree(): Tree {
    let trees = this.v2Trees();
    return new Funnel(mergeTrees(trees), {
      destDir: this.addonInstance.pkg.name
    });
  }

  private v2Trees() {
    let { addonInstance } = this;
    let trees = [];

    // addonInstance.root gets modified by a customized "main" or
    // "ember-addon.main" in package.json. We want the real package root here
    // (the place where package.json lives).
    let root = dirname(pkgUpSync(addonInstance.root));

    let rootTree = new UnwatchedDir(root);
    trees.push(new RewritePackageJSON(rootTree));

    let mainModule = require(addonInstance.constructor._meta_.modulePath);

    if (customizes(mainModule, 'treeFor')) {
      console.log(`TODO: ${addonInstance.pkg.name} has customized treeFor`);
      return trees;
    }

    if (customizes(mainModule, 'treeForAddon', 'treeForAddonTemplates')) {
      console.log(`TODO: ${addonInstance.pkg.name} may have customized the addon tree`);
    } else {
      if (existsSync(join(root, 'addon'))) {
        trees.push(
          transpile(addonInstance, new Funnel(rootTree, {
            srcDir: 'addon'
          }))
        );
      }
    }

    if (customizes(mainModule, 'treeForAddonTestSupport')) {
      console.log(`TODO: ${addonInstance.pkg.name} may have customized the addon test support tree`);
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

    if (customizes(mainModule, 'treeForApp', 'treeForTemplates')) {
      console.log(`TODO: ${addonInstance.pkg.name} may have customized the app tree`);
    } else {
      if (existsSync(join(root, 'app'))) {
        trees.push(
          transpile(addonInstance, new Funnel(rootTree, {
            srcDir: 'app',
            destDir: '_app_'
          }))
        );
      }
    }

    if (customizes(mainModule, 'treeForPublic')) {
      console.log(`TODO: ${addonInstance.pkg.name} may have customized the public tree`);
    } else {
      if (existsSync(join(root, 'public'))) {
        trees.push(
          new Funnel(rootTree, {
            srcDir: 'public',
            destDir: 'public'
          })
        );
      }
    }

    return trees;
  }
}
function customizes(mainModule, ...treeNames) {
  return treeNames.find(treeName => mainModule[treeName]);
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
