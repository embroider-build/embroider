import type V1InstanceCache from './v1-instance-cache';
import type { Package } from '@embroider/core';
import SmooshPackageJSON from './smoosh-package-json';
import broccoliMergeTrees from 'broccoli-merge-trees';
import type { Node } from 'broccoli-node-api';
import EmptyPackageTree from './empty-package-tree';

export default function buildCompatAddon(originalPackage: Package, v1Cache: V1InstanceCache): Node {
  if (originalPackage.isV2Addon()) {
    throw new Error(
      `bug in @embroider/compat. We should not see any v2 addons here, but ${originalPackage.name} as ${originalPackage.root} is a v2 addon`
    );
  }

  let oldPackages = v1Cache.getAddons(originalPackage.root);

  if (oldPackages.length > 1) {
    // extensibility hook that allows a compat adapter to optimize its own
    // smooshing. We do it early so that if it reduces all the way to zero, the
    // next check will handle that.
    oldPackages = oldPackages[0].reduceInstances(oldPackages);
  }

  if (oldPackages.length === 0) {
    // this happens when the v1 addon wasn't actually getting instantiated at
    // all, which can happen if the app uses `addons.blacklist` or another addon
    // uses `shouldIncludeChildAddon`.
    //
    // we still keep a place for this addon in the rewritten addon workspace,
    // because that whole process only depends on looking at all the
    // package.json files on disk -- it can't know which ones are going to end
    // up unused at this point.
    return new EmptyPackageTree(originalPackage);
  }

  let needsSmooshing = oldPackages.length > 1 && oldPackages[0].hasAnyTrees();
  if (needsSmooshing) {
    let trees = oldPackages.map(pkg => pkg.v2Tree).reverse();
    let smoosher = new SmooshPackageJSON(trees, { annotation: originalPackage.name });
    return broccoliMergeTrees([...trees, smoosher], { overwrite: true });
  } else {
    return oldPackages[0].v2Tree;
  }
}
