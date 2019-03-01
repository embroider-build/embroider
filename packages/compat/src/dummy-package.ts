import { Package, PackageCache } from "@embroider/core";
import { Memoize } from "typescript-memoize";
import cloneDeep  from "lodash/cloneDeep";

export default class DummyPackage extends Package {
  constructor(root: string, private owningAddon: Package, packageCache: PackageCache) {
    super(root, true, packageCache);
  }

  @Memoize()
  get packageJSON() {
    let pkg = cloneDeep(this.owningAddon.packageJSON);
    pkg.name = 'dummy';
    if (!pkg.devDependencies) {
      pkg.devDependencies = {};
    }
    // the dummy app has a dependency on the owning addon
    pkg.devDependencies[this.owningAddon.name] = this.owningAddon.version;
    return pkg;
  }

  @Memoize()
  get dependencies(): Package[] {
    // we can't use this.owningAddon.dependencies because that won't include
    // devDeps. We need to construct a new temporary package with the
    // mayUseDevDeps flag to true.
    let upstream = new Package(this.owningAddon.root, true, this.packageCache).dependencies.slice();
    // the dummy app has a dependency on the owning addon
    upstream.unshift(this.owningAddon);
    return upstream;
  }
}
