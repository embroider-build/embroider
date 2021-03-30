import V1InstanceCache from './v1-instance-cache';
import { Package } from '@embroider/core';
import SmooshPackageJSON from './smoosh-package-json';
import broccoliMergeTrees from 'broccoli-merge-trees';
import { Node } from 'broccoli-node-api';
import OneShot from './one-shot';
import { Funnel } from 'broccoli-funnel';
import { UnwatchedDir, WatchedDir } from 'broccoli-source';
import EmptyPackageTree from './empty-package-tree';

export default function cachedBuildCompatAddon(originalPackage: Package, v1Cache: V1InstanceCache): Node {
  let tree = buildCompatAddon(originalPackage, v1Cache);
  if (!originalPackage.mayRebuild) {
    tree = new OneShot(tree);
  }
  return tree;
}

function buildCompatAddon(originalPackage: Package, v1Cache: V1InstanceCache): Node {
  if (originalPackage.isV2Addon()) {
    // this case is needed when a native-v2 addon depends on a
    // non-native-v2 addon. (The non-native one will get rewritten and
    // therefore moved, so to continue depending on it the native one needs to
    // move too.)
    return withoutNodeModules(originalPackage);
  }

  let oldPackages = v1Cache.getAddons(originalPackage.root);

  if (oldPackages.length === 0) {
    // this happens when the v1 addon wasn't actually getting instantiated at
    // all, which can happen if the app uses `addons.blacklist` or another addon
    // uses `shouldIncludeChildAddon`.
    //
    // we still keep a place for this addon in the rewritten addon workspace,
    // because that whole process only depends on looking at all the
    // package.json files on disk -- it can't know which ones are going to end
    // up unused at this point.
    return new EmptyPackageTree(originalPackage.name);
  }

  let needsSmooshing = oldPackages[0].hasAnyTrees();
  if (needsSmooshing) {
    let trees = oldPackages.map(pkg => pkg.v2Tree).reverse();
    let smoosher = new SmooshPackageJSON(trees, { annotation: originalPackage.name });
    return broccoliMergeTrees([...trees, smoosher], { overwrite: true });
  } else {
    return oldPackages[0].v2Tree;
  }
}

function withoutNodeModules(originalPackage: Package): Node {
  let Klass = originalPackage.mayRebuild ? WatchedDir : UnwatchedDir;
  return new Funnel(new Klass(originalPackage.root), {
    exclude: ['node_modules'],
  });
}
