import { Package, PackageCache } from '@embroider/core';
import { Memoize } from 'typescript-memoize';
import cloneDeep from 'lodash/cloneDeep';

// A specialized Package that represents a Dummy App (the app that comes along
// with an addon for purposes of testing that addon).
export default class DummyPackage extends Package {
  constructor(root: string, private owningAddon: Package, packageCache: PackageCache) {
    super(root, packageCache, true);
  }

  @Memoize()
  protected get internalPackageJSON() {
    let pkg = cloneDeep(this.owningAddon.packageJSON);
    pkg.name = 'dummy';
    return pkg;
  }

  @Memoize()
  get nonResolvableDeps(): Map<string, Package> {
    let deps = super.nonResolvableDeps;
    if (!deps) {
      deps = new Map();
    }
    deps.set(this.owningAddon.name, this.owningAddon);
    return deps;
  }
}

// A specialized Package that represents an Addon that owns the current Dummy
// App. It's special because it always supports rebuilds.
export class OwningAddon extends Package {
  constructor(root: string, packageCache: PackageCache) {
    super(root, packageCache, false);
  }

  get mayRebuild(): boolean {
    return true;
  }
}
