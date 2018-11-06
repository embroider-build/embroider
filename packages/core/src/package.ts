import { Memoize } from 'typescript-memoize';
import { readFileSync } from "fs";
import { join, dirname } from 'path';
import PackageCache from './package-cache';
import flatMap from 'lodash/flatMap';
import resolve from 'resolve';

export default class Package {
  private dependencyKeys: string[];

  constructor(
    public readonly root: string,
    mayUseDevDeps: boolean,
    private packageCache: PackageCache
  ) {
      this.dependencyKeys = mayUseDevDeps ? ['dependencies', 'devDependencies'] : ['dependencies'];
  }

  get name() {
    return this.packageJSON.name;
  }

  @Memoize()
  get packageJSON() {
    return JSON.parse(readFileSync(join(this.root, 'package.json'), 'utf8'));
  }

  get dependencies(): Package[] {
    return this.findDependencies();
  }

  @Memoize()
  private findDependencies(): Package[] {
    let names = flatMap(this.dependencyKeys, key => Object.keys(this.packageJSON[key] || {}));
    return names.map(name => {
      let addonRoot = dirname(resolve.sync(join(name, 'package.json'), { basedir: this.root }));
      return this.packageCache.getPackage(addonRoot, this);
    }).filter(Boolean);
  }

  @Memoize()
  get descendants(): Package[] {
    return this.findDescendants();
  }

  findDescendants(filter?: (pkg: Package) => boolean) {
    let pkgs = new Set();
    let queue : Package[] = [this];
    while (queue.length > 0) {
      let pkg = queue.shift();
      if (!pkgs.has(pkg)) {
        pkgs.add(pkg);
        pkg.dependencies.filter(filter).forEach(d => queue.push(d));
      }
    }
    pkgs.delete(this);
    return [...pkgs.values()];
  }

  // This is all the packages that depend on us. Not valid until the other
  // packages have all had a chance to find their dependencies.
  get dependedUponBy() {
    return this.packageCache.dependendUponBy.get(this);
  }
}
