import { Tree } from "broccoli-plugin";
import { Memoize } from "typescript-memoize";
import V1InstanceCache from "./v1-instance-cache";
import Package, { EmberPackage } from './package';
import V1Addon from "./v1-addon";
import MovedPackageCache from "./moved-package-cache";
import SmooshPackageJSON from "./smoosh-package-json";
import broccoliMergeTrees from "broccoli-merge-trees";
import { AddonPackageJSON } from "./metadata";
import { UnwatchedDir } from 'broccoli-source';
import ChooseTree from './choose-tree';
import { join } from 'path';

export default class MovedPackage extends EmberPackage {
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
    if (this.isNativeV2) {
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

  get name() {
    return this.originalPackage.name;
  }

  @Memoize()
  get packageJSON(): AddonPackageJSON {
    if (this.isNativeV2) {
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

  get dependencies(): Package[] {
    return this.originalPackage.dependencies.map(dep => this.moved.getPackage(dep.root, this));
  }

  get isNativeV2(): boolean {
    return this.originalPackage.isNativeV2;
  }

  private needsSmooshing() {
    return this.oldPackages.length > 1 && this.oldPackages[0].hasAnyTrees();
  }

  get legacyAppTree(): Tree | undefined {
    if (this.isNativeV2) {
      let appDir = this.packageJSON['ember-addon']['app-js'];
      if (appDir) {
        return new UnwatchedDir(join(this.originalPackage.root, appDir));
      }
    } else {
      return new ChooseTree(this.asTree(), {
        annotation: `vanilla-choose-app-tree.${this.name}`,
        srcDir: (_: string) => {
          return this.packageJSON['ember-addon']['app-js'];
        }
      });
    }
  }
}
