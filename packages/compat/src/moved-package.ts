import { Tree } from "broccoli-plugin";
import { Memoize } from "typescript-memoize";
import V1InstanceCache from "./v1-instance-cache";
import { Package } from '@embroider/core';
import V1Addon from "./v1-addon";
import MovedPackageCache from "./moved-package-cache";
import SmooshPackageJSON from "./smoosh-package-json";
import broccoliMergeTrees from "broccoli-merge-trees";
import { UnwatchedDir } from 'broccoli-source';
import ChooseTree from './choose-tree';
import { join } from 'path';

export default class MovedPackage extends Package {
  private smoosher: SmooshPackageJSON | undefined;

  constructor(
    private moved: MovedPackageCache,
    readonly root: string,
    private originalPackage: Package,
    private v1Cache: V1InstanceCache,
  ) {
    super();
  }

  @Memoize()
  private get oldPackages(): V1Addon[] {
    return this.v1Cache.getAddons(this.originalPackage.root);
  }

  @Memoize()
  asTree(): Tree {
    if (this.originalPackage.isV2) {
      // todo: this case is needed when a native-v2 addon depends on a
      // non-native-v2 addon. (The non-native one will get rewritten and
      // therefore moved, so to continue depending on it the native one needs to
      // move too.) It should probably grab the whole package off disk and just
      // filter out node_modules.
      throw new Error(`unimplemented`);
    }

    if (this.needsSmooshing()) {
      let trees = this.oldPackages.map(pkg => pkg.v2Tree);
      this.smoosher = new SmooshPackageJSON(trees);
      return broccoliMergeTrees([...trees, this.smoosher], { overwrite: true });
    } else {
      return this.oldPackages[0].v2Tree;
    }
  }

  @Memoize()
  get dependencies(): Package[] {
    let deps = this.originalPackage.packageJSON.dependencies;
    if (!deps) { return []; }
    let names = Object.keys(deps);
    return names.map(name => this.moved.resolve(name, this));
  }

  get name() {
    return this.originalPackage.name;
  }

  get isEmberPackage() {
    return this.originalPackage.isEmberPackage;
  }

  @Memoize()
  get packageJSON() {
    if (this.originalPackage.isV2) {
      return this.originalPackage.packageJSON;
    } else if (this.needsSmooshing()) {
      if (!this.smoosher) {
        throw new Error("tried to access smooshed package.json before it was built");
      }
      return this.smoosher.lastPackageJSON;
    } else {
      return this.oldPackages[0].rewrittenPackageJSON;
    }
  }

  get isV2(): boolean {
    return true;
  }

  private needsSmooshing() {
    return this.oldPackages.length > 1 && this.oldPackages[0].hasAnyTrees();
  }

  get legacyAppTree(): Tree | undefined {
    if (this.originalPackage.isV2) {
      let appDir = this.originalPackage.meta['app-js'];
      if (appDir) {
        return new UnwatchedDir(join(this.originalPackage.root, appDir));
      }
    } else {
      return new ChooseTree(this.asTree(), {
        annotation: `vanilla-choose-app-tree.${this.name}`,
        srcDir: (_: string) => {
          return this.meta['app-js'];
        }
      });
    }
  }
}
