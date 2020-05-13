import { Package, PackageCache } from '@embroider/core';
import { Memoize } from 'typescript-memoize';
import cloneDeep from 'lodash/cloneDeep';

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
