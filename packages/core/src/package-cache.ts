import BasicPackage from "./basic-package";
import Package from './package';
import { realpathSync } from 'fs';
import { getOrCreate } from './get-or-create';

export default class PackageCache {
  private dependsOn: WeakMap<Package, Set<Package>> = new WeakMap();
  private dependendUponBy: WeakMap<Package, Set<Package>> = new WeakMap();

  private cache: Map<string, Package> = new Map();

  getPackage(inputRoot: string, fromParent?: Package | undefined ): Package {
    let root = realpathSync(inputRoot);
    let p = getOrCreate(this.cache, root, () => {
      let newPackage = new BasicPackage(root, !Boolean(fromParent), this);
      return newPackage;
    });
    if (fromParent) {
      getOrCreate(this.dependsOn, fromParent, ()=> new Set()).add(p);
      getOrCreate(this.dependendUponBy, p, () => new Set()).add(fromParent);
    }
    return p;
  }

  packagesThatDependOn(pkg: Package): Set<Package> {
    return this.dependendUponBy.get(pkg) || new Set();
  }
}
