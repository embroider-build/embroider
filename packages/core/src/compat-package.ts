import PackageCache from "./compat-package-cache";
import Addon from "./addon";
import { Tree } from "broccoli-plugin";
import { Memoize } from 'typescript-memoize';
import { join, dirname } from 'path';
import flatMap from 'lodash/flatMap';
import resolve from 'resolve';
import { readFileSync } from "fs";

export default abstract class CompatPackage {
  constructor(public originalRoot: string, private emitNewRoot?: (message: string) => void) {
  }

  abstract name: string;
  protected abstract dependencyKeys: string[];

  // This is the contents of the real packageJSON on disk.
  @Memoize()
  get originalPackageJSON() {
    return JSON.parse(readFileSync(join(this.originalRoot, 'package.json'), 'utf8'));
  }

  protected abstract packageCache: PackageCache;

  get dependencies(): Addon[] {
    return this.findDependencies();
  }

  @Memoize()
  private findDependencies(): Addon[] {
    let names = flatMap(this.dependencyKeys, key => Object.keys(this.originalPackageJSON[key] || {}));
    return names.map(name => {
      let addonRoot = dirname(resolve.sync(join(name, 'package.json'), { basedir: this.originalRoot }));
      return this.packageCache.getPackage(addonRoot, this);
    }).filter(Boolean);
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
    if (this.emitNewRoot) {
      this.emitNewRoot(value);
    }
  }

  @Memoize()
  get descendants(): Addon[] {
    return this.findDescendants(false);
  }

  private findDescendants(activeOnly: boolean) {
    let pkgs = new Set();
    let queue : CompatPackage[] = [this];
    while (queue.length > 0) {
      let pkg = queue.shift();
      if (!pkgs.has(pkg)) {
        pkgs.add(pkg);
        let section = activeOnly ? pkg.activeDependencies : pkg.dependencies;
        section.forEach(d => queue.push(d));
      }
    }
    pkgs.delete(this);
    return [...pkgs.values()];
  }

  @Memoize()
  get activeDependencies(): Addon[] {
    // todo: filter by addon-provided hook
    return this.dependencies;
  }

  @Memoize()
  get activeDescendants(): Addon[] {
    return this.findDescendants(true);
  }

  // This is all the NPM packages we depend on, as opposed to `dependencies`
  // which is just the Ember packages we depend on.
  get npmDependencies() {
    this.findDependencies();
    return this.packageCache.dependsOn.get(this) || new Set();
  }

  abstract dependedUponBy: Set<CompatPackage>;

  abstract vanillaTree: Tree;
}
