import PackageCache from "./package-cache";
import Addon from "./addon";
import { Tree } from "broccoli-plugin";
import { Memoize } from 'typescript-memoize';
import { join, dirname } from 'path';
import flatMap from 'lodash/flatMap';
import resolve from 'resolve';
import { readFileSync } from "fs";

export default abstract class Package {
  constructor(public root: string) {
  }

  abstract name: string;
  protected abstract dependencyKeys: string[];

  // This is the contents of the real packageJSON on disk.
  @Memoize()
  get originalPackageJSON() {
    return JSON.parse(readFileSync(join(this.root, 'package.json'), 'utf8'));
  }

  protected abstract packageCache: PackageCache;

  @Memoize()
  get dependencies(): Addon[] {
    // todo: call a user-provided activeDependencies hook if provided
    let names = flatMap(this.dependencyKeys, key => Object.keys(this.originalPackageJSON[key] || {}));
    return names.map(name => {
      let addonRoot = dirname(resolve.sync(join(name, 'package.json'), { basedir: this.root }));
      return this.packageCache.getPackage(addonRoot, this);
    }).filter(Boolean);
  }

  @Memoize()
  get descendants(): Addon[] {
    return this.findDescendants(false);
  }

  private findDescendants(activeOnly: boolean) {
    let pkgs = new Set();
    let queue : Package[] = [this];
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

  abstract vanillaTree: Tree;
}
