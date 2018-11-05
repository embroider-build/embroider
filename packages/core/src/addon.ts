import { join } from 'path';
import { Tree } from 'broccoli-plugin';
import mergeTrees from 'broccoli-merge-trees';
import ChooseTree from './choose-tree';
import CompatPackage from './compat-package';
import Package from './package';
import V1Addon from './v1-addon';
import get from 'lodash/get';
import { UnwatchedDir } from 'broccoli-source';
import { Memoize } from 'typescript-memoize';
import SmooshPackageJSON from './smoosh-package-json';
import CompatPackageCache from './compat-package-cache';

export default class Addon implements CompatPackage {
  private oldPackages: V1Addon[] = [];
  private smoosher: SmooshPackageJSON | undefined;

  constructor(private pkg: Package, private compatCache: CompatPackageCache) {
    this.packageAsAddon = this.packageAsAddon.bind(this);
    this.oldPackages = compatCache.v1Addons(pkg);
  }

  get originalRoot() {
    return this.pkg.root;
  }

  // This is the contents of the real packageJSON on disk.
  get originalPackageJSON() {
    return this.pkg.packageJSON;
  }

  get dependencies(): Addon[] {
    return this.pkg.dependencies.map(this.packageAsAddon).filter(pkg => pkg.isEmberPackage);
  }

  private privRoot: string | undefined;
  get root(): string {
    if (!this.privRoot) {
      throw new Error(`package ${this.name} does not know its final root location yet`);
    }
    return this.privRoot;
  }

  set root(value: string) {
    if (this.privRoot) {
      throw new Error(`double set of root in package ${this.name}`);
    }
    this.privRoot = value;
  }

  get descendants(): Addon[] {
    return this.pkg.findDescendants(pkg => this.packageAsAddon(pkg).isEmberPackage).map(this.packageAsAddon);
  }

  get activeDependencies(): Addon[] {
    // todo: filter by addon-provided hook
    return this.dependencies;
  }

  @Memoize()
  get activeDescendants(): Addon[] {
    // todo: filter by addon-provided hook
    return this.descendants;
  }

  // This is all the NPM packages we depend on, as opposed to `dependencies`
  // which is just the Ember packages we depend on.
  get npmDependencies() {
    return this.pkg.dependencies.map(this.packageAsAddon);
  }

  get name(): string {
    return this.pkg.name;
  }

  private packageAsAddon(pkg: Package): Addon {
    return this.compatCache.lookupAddon(pkg);
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
    return new Set([...this.pkg.dependedUponBy].map(pkg => {
      return this.compatCache.lookup(pkg);
    }));
  }
}
