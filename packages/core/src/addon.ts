import { join } from 'path';
import { Tree } from 'broccoli-plugin';
import V1InstanceCache from './v1-instance-cache';
import PackageCache from './compat-package-cache';
import mergeTrees from 'broccoli-merge-trees';
import ChooseTree from './choose-tree';
import Package from './compat-package';
import V1Addon from './v1-addon';
import get from 'lodash/get';
import { UnwatchedDir } from 'broccoli-source';
import { Memoize } from 'typescript-memoize';
import SmooshPackageJSON from './smoosh-package-json';

export default class Addon extends Package {
  private oldPackages: V1Addon[] = [];
  private smoosher: SmooshPackageJSON | undefined;

  constructor(public originalRoot: string, protected packageCache: PackageCache, private v1Cache: V1InstanceCache) {
    super(originalRoot);
  }

  get name(): string {
    return this.originalPackageJSON.name;
  }

  // this is where we inform the package that it's being consumed by another,
  // meaning it should take configuration from that other into account.
  addParent(pkg: Package){
    let v1Addon = this.v1Cache.getAddon(this.originalRoot, pkg.originalRoot);
    if (v1Addon) {
      this.oldPackages.push(v1Addon);
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
    } else if (this.needsSmooshing()) {
      if (!this.smoosher) {
        throw new Error("tried to access smooshed package.json before it was built");
      }
      return this.smoosher.lastPackageJSON;
    } else {
      return this.oldPackages[0].rewrittenPackageJSON;
    }
  }

  private needsSmooshing() {
    return this.oldPackages.length > 1 && this.oldPackages[0].hasAnyTrees();
  }

  get vanillaTree(): Tree {
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
      return mergeTrees([...trees, this.smoosher], { overwrite: true });
    } else {
      return this.oldPackages[0].v2Tree;
    }
  }

  protected dependencyKeys = ['dependencies'];

  get legacyAppTree(): Tree {
    if (this.isNativeV2) {
      let appDir = get(this.packageJSON, 'ember-addon.app-js');
      if (appDir) {
        return new UnwatchedDir(join(this.originalRoot, appDir));
      }
    } else {
      return new ChooseTree(this.vanillaTree, {
        annotation: `vanilla-choose-app-tree.${this.name}`,
        srcDir: () => {
          return get(this.packageJSON, 'ember-addon.app-js');
        }
      });
    }
  }

  get isEmberPackage() : boolean {
    let keywords = this.originalPackageJSON.keywords;
    return keywords && keywords.indexOf('ember-addon') !== -1;
  }

  // This is all the Ember packages that depend on us. Not valid until the other
  // packages have all had a chance to find their dependencies.
  get dependedUponBy() {
    return this.packageCache.dependendUponBy.get(this);
  }
}
