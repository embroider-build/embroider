import { Package, PackageCache } from '@embroider/core';
import { Memoize } from 'typescript-memoize';
import cloneDeep from 'lodash/cloneDeep';

// A specialized Package that represents a Dummy App (the app that comes along
// with an addon for purposes of testing that addon).
export default class DummyPackage extends Package {
  constructor(root: string, private owningAddonRoot: string, packageCache: PackageCache) {
    super(root, packageCache, true);
  }

  @Memoize()
  protected get internalPackageJSON() {
    let pkg = cloneDeep(this.packageCache.get(this.owningAddonRoot).packageJSON);
    pkg.name = 'dummy';
    return pkg;
  }

  @Memoize()
  get nonResolvableDeps(): Map<string, Package> {
    let deps = super.nonResolvableDeps;
    if (!deps) {
      deps = new Map();
    }
    const owningAddon = this.packageCache.get(this.owningAddonRoot);
    deps.set(owningAddon.name, owningAddon);
    return deps;
  }
}
