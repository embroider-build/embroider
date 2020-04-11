import V1InstanceCache from './v1-instance-cache';
import { Package } from '@embroider/core';
import SmooshPackageJSON from './smoosh-package-json';
import broccoliMergeTrees from 'broccoli-merge-trees';
import { Tree } from 'broccoli-plugin';
import OneShot from './one-shot';
import Funnel from 'broccoli-funnel';
import { UnwatchedDir } from 'broccoli-source';
import EmptyPackageTree from './empty-package-tree';

export default function cachedBuildCompatAddon(
  originalPackage: Package,
  v1Cache: V1InstanceCache
): { tree: Tree; nonResolvableDeps: Package[] } {
  let { tree, nonResolvableDeps } = buildCompatAddon(originalPackage, v1Cache);
  if (!originalPackage.mayRebuild) {
    tree = new OneShot(tree);
  }
  return { tree, nonResolvableDeps };
}

function buildCompatAddon(
  originalPackage: Package,
  v1Cache: V1InstanceCache
): { tree: Tree; nonResolvableDeps: Package[] } {
  if (originalPackage.isV2Addon()) {
    // this case is needed when a native-v2 addon depends on a
    // non-native-v2 addon. (The non-native one will get rewritten and
    // therefore moved, so to continue depending on it the native one needs to
    // move too.)
    return { tree: withoutNodeModules(originalPackage.root), nonResolvableDeps: [] };
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
    return { tree: new EmptyPackageTree(), nonResolvableDeps: [] };
  }

  let needsSmooshing = oldPackages[0].hasAnyTrees();
  if (needsSmooshing) {
    let trees = oldPackages.map(pkg => pkg.v2Tree).reverse();
    let smoosher = new SmooshPackageJSON(trees);
    return {
      tree: broccoliMergeTrees([...trees, smoosher], { overwrite: true }),
      nonResolvableDeps: oldPackages[0].nonResolvableDependencies(), // TODO: combine nonResolvableDeps from all copies
    };
  } else {
    return { tree: oldPackages[0].v2Tree, nonResolvableDeps: oldPackages[0].nonResolvableDependencies() };
  }
}

function withoutNodeModules(root: string): Tree {
  return new Funnel(new UnwatchedDir(root), {
    exclude: ['node_modules'],
  });
}
