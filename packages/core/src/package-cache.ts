import Addon from "./addon";
import V1InstanceCache from "./v1-instance-cache";
import Package from "./compat-package";
import { realpathSync } from 'fs';

export default class PackageCache {
  dependsOn: WeakMap<Package, Set<Addon>> = new WeakMap();
  dependendUponBy: WeakMap<Addon, Set<Package>> = new WeakMap();

  constructor(private v1InstanceCache: V1InstanceCache) {}

  private cache: Map<string, Addon> = new Map();

  getPackage(inputRoot: string, fromParent: Package) : Addon | undefined {
    let root = realpathSync(inputRoot);
    if (!this.cache.has(root)) {
      let newPackage = new Addon(root, this, this.v1InstanceCache);
      this.cache.set(root, newPackage);
      this.dependendUponBy.set(newPackage, new Set());
    }
    let p = this.cache.get(root);
    if (!this.dependsOn.has(fromParent)) {
      this.dependsOn.set(fromParent, new Set());
    }
    this.dependsOn.get(fromParent).add(p);
    this.dependendUponBy.get(p).add(fromParent);
    if (p.isEmberPackage) {
      p.addParent(fromParent);
      return p;
    }
  }
}
