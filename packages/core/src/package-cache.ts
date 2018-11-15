import BasicPackage from "./basic-package";
import Package from './package';
import { realpathSync } from 'fs';
import { getOrCreate } from './get-or-create';
import resolve from 'resolve';
import { join, dirname } from 'path';

export default class PackageCache {
  private rootCache: Map<string, Package> = new Map();

  private dependsOn: WeakMap<Package, Set<Package>> = new WeakMap();
  private dependendUponBy: WeakMap<Package, Set<Package>> = new WeakMap();
  private resolutionCache: WeakMap<Package, Map<string, Package>> = new WeakMap();

  resolve(packageName: string, fromPackage: Package): Package {
    let cache = getOrCreate(this.resolutionCache, fromPackage, () => new Map());
    return getOrCreate(cache, packageName, () => {
      let root = dirname(resolve.sync(join(packageName, 'package.json'), { basedir: fromPackage.root }));
      let pkg = this.getAddon(root);
      if (fromPackage) {
        getOrCreate(this.dependsOn, fromPackage, ()=> new Set()).add(pkg);
        getOrCreate(this.dependendUponBy, pkg, () => new Set()).add(fromPackage);
      }
      return pkg;
    });
  }

  private getAddon(packageRoot: string) {
    return this.getPackage(packageRoot, true);
  }

  getApp(packageRoot: string) {
    return this.getPackage(packageRoot, false);
  }

  private getPackage(packageRoot: string, isAddon: boolean): Package {
    let root = realpathSync(packageRoot);
    let p = getOrCreate(this.rootCache, root, () => {
      return new BasicPackage(root, !isAddon, this);
    });
    return p;
  }

  packagesThatDependOn(pkg: Package): Set<Package> {
    return this.dependendUponBy.get(pkg) || new Set();
  }
}
