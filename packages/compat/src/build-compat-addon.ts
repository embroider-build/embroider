import V1InstanceCache from "./v1-instance-cache";
import { Package } from '@embroider/core';
import SmooshPackageJSON from "./smoosh-package-json";
import broccoliMergeTrees from "broccoli-merge-trees";
import { Tree } from "broccoli-plugin";
import OneShot from "./one-shot";

export default function cachedBuildCompatAddon(originalPackage: Package, v1Cache: V1InstanceCache): Tree {
  let tree = buildCompatAddon(originalPackage, v1Cache);
  if (!originalPackage.mayRebuild) {
    tree = new OneShot(tree);
  }
  return tree;
}

function buildCompatAddon(originalPackage: Package, v1Cache: V1InstanceCache): Tree {
  if (originalPackage.isV2) {
    // todo: this case is needed when a native-v2 addon depends on a
    // non-native-v2 addon. (The non-native one will get rewritten and
    // therefore moved, so to continue depending on it the native one needs to
    // move too.) It should probably grab the whole package off disk and just
    // filter out node_modules.
    throw new Error(`unimplemented`);
  }

  let oldPackages = v1Cache.getAddons(originalPackage.root);
  let needsSmooshing = oldPackages.length > 1 && oldPackages[0].hasAnyTrees();

  if (needsSmooshing) {
    let trees = oldPackages.map(pkg => pkg.v2Tree);
    let smoosher = new SmooshPackageJSON(trees);
    return broccoliMergeTrees([...trees, smoosher], { overwrite: true });
  } else {
    return oldPackages[0].v2Tree;
  }
}
