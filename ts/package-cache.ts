import AddonPackage from "./package";
import V1InstanceCache from "./v1-instance-cache";
import Package from "./package";

export default class PackageCache {
  constructor(private v1InstanceCache: V1InstanceCache) {}

  private cache: Map<string, AddonPackage> = new Map();

  getPackage(root: string, fromParent: Package) : AddonPackage | undefined {
    if (!this.cache.has(root)) {
      this.cache.set(root, new AddonPackage(root, this, this.v1InstanceCache));
    }
    let p = this.cache.get(root);
    if (p.isEmberPackage) {
      p.addParent(fromParent);
      return p;
    }
  }
}
