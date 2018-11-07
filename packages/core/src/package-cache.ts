import BasicPackage from "./basic-package";
import Package from './package';
import { realpathSync } from 'fs';

export default class PackageCache {
  private dependsOn: WeakMap<Package, Set<Package>> = new WeakMap();
  private dependendUponBy: WeakMap<Package, Set<Package>> = new WeakMap();

  private cache: Map<string, Package> = new Map();

  getPackage(inputRoot: string, fromParent?: Package ) : Package | undefined {
    let root = realpathSync(inputRoot);
    if (!this.cache.has(root)) {
      let newPackage = new BasicPackage(root, !Boolean(fromParent), this);
      this.cache.set(root, newPackage);
      this.dependendUponBy.set(newPackage, new Set());
    }
    let p = this.cache.get(root);
    if (fromParent) {
      if (!this.dependsOn.has(fromParent)) {
        this.dependsOn.set(fromParent, new Set());
      }
      this.dependsOn.get(fromParent).add(p);
      this.dependendUponBy.get(p).add(fromParent);
    }
    return p;
  }

  packagesThatDependOn(pkg: Package): Set<Package> {
    return this.dependendUponBy.get(pkg);
  }
}
