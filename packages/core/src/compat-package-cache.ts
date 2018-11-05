import Package from "./package";
import V1InstanceCache from "./v1-instance-cache";
import Addon from "./addon";
import App from "./app";
import V1Addon from "./v1-addon";
import CompatPackage from "./compat-package";

export default class CompatPackageCache {
  private cache = new WeakMap();

  constructor(private v1Cache: V1InstanceCache, private appPkg: Package, private app: App) {
  }

  lookup(pkg: Package): CompatPackage {
    if (pkg === this.appPkg) {
      return this.app;
    }
    return this.lookupAddon(pkg);
  }

  lookupAddon(pkg: Package): Addon {
    if (!this.cache.has(pkg)) {
      this.cache.set(pkg, new Addon(pkg, this));
    }
    return this.cache.get(pkg);
  }

  v1Addons(pkg: Package): V1Addon[] {
    return this.v1Cache.getAddons(pkg.root);
  }
}
