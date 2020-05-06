import { Package, PackageCache } from './';
import { Memoize } from 'typescript-memoize';
import cloneDeep from 'lodash/cloneDeep';

export default class ExtendedPackage extends Package {
  private originalPackage: Package;
  constructor(root: string, private extraDevDeps: Package[], packageCache: PackageCache) {
    super(root, packageCache, true);
    this.originalPackage = packageCache.getApp(root);
  }

  @Memoize()
  get packageJSON() {
    let pkg = cloneDeep(this.originalPackage.packageJSON);
    if (!pkg.devDependencies) {
      pkg.devDependencies = {};
    }
    for (let dep of this.extraDevDeps) {
      pkg.devDependencies[dep.name] = dep.version;
    }
    return pkg;
  }

  @Memoize()
  get dependencies(): Package[] {
    return this.originalPackage.dependencies.concat(this.extraDevDeps);
  }
}
