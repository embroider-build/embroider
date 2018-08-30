import { join } from 'path';
import { Tree } from 'broccoli-plugin';
import mergeTrees from 'broccoli-merge-trees';
import V1InstanceCache from './v1-instance-cache';
import PackageCache from './package-cache';
import { todo } from './messages';
import ChooseTree from './choose-tree';
import Package from './package';
import V1Addon from './v1-addon';
import get from 'lodash/get';
import { UnwatchedDir } from 'broccoli-source';
import { Memoize } from 'typescript-memoize';

export default class Addon extends Package {
  private oldPackage: V1Addon;

  constructor(public root: string, protected packageCache: PackageCache, private v1Cache: V1InstanceCache) {
    super(root);
  }

  get name(): string {
    return this.oldPackage.name;
  }

  // this is where we inform the package that it's being consumed by another,
  // meaning it should take configuration from that other into account.
  addParent(pkg: Package){
    let v1Addon = this.v1Cache.getAddon(this.root, pkg.root);
    if (v1Addon) {
      if (!this.oldPackage) {
        this.oldPackage = v1Addon;
      } else if (v1Addon.hasAnyTrees()){
        todo(`duplicate build of ${v1Addon.name}`);
      }
    }
  }

  get isNativeV2(): boolean {
    let version = get(this.originalPackageJSON, 'ember-addon.version');
    return version === 2;
  }

  // This is a V2 package.json. For a native-v2 package, it's the same thing as
  // `this.originalPackageJSON`. But for non-native-v2 packages, it's derived
  // during the building of vanillaTree, and it's only valid to use it after
  // you've ensured the build has run.
  @Memoize()
  get packageJSON() {
    if (this.isNativeV2) {
      return this.originalPackageJSON;
    } else {
      return this.oldPackage.packageJSONRewriter.lastPackageJSON;
    }
  }

  get vanillaTree(): Tree {
    if (this.isNativeV2) {
      throw new Error(`we should not be using this on native v2 addons`);
    }
    let trees = this.oldPackage.v2Trees;
    return mergeTrees(trees);
  }

  protected dependencyKeys = ['dependencies'];

  get legacyAppTree(): Tree {
    if (this.isNativeV2) {
      let appDir = get(this.packageJSON, 'ember-addon.app-js');
      if (appDir) {
        return new UnwatchedDir(join(this.root, appDir));
      }
    } else {
      return new ChooseTree(this.vanillaTree, {
        annotation: `vanilla-choose-app-tree.${this.name}`,
        srcDir: () => {
          let pkg = this.oldPackage.packageJSONRewriter.lastPackageJSON;
          return get(pkg, 'ember-addon.app-js');
        }
      });
    }
  }

  get isEmberPackage() : boolean {
    let keywords = this.originalPackageJSON.keywords;
    return keywords && keywords.indexOf('ember-addon') !== -1;
  }
}
