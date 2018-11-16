import { Memoize } from 'typescript-memoize';
import PackageCache from './package-cache';
import flatMap from 'lodash/flatMap';
import Package from './package';

export default class BasicPackage extends Package {
  private dependencyKeys: ("dependencies" | "devDependencies")[];

  constructor(
    readonly root: string,
    mayUseDevDeps: boolean,
    private packageCache: PackageCache
  ) {
    super();
    this.dependencyKeys = mayUseDevDeps ? ['dependencies', 'devDependencies'] : ['dependencies'];
  }

  @Memoize()
  get dependencies(): Package[] {
    let names = flatMap(this.dependencyKeys, key => Object.keys(this.packageJSON[key] || {}));
    return names.map(name => this.packageCache.resolve(name, this));
  }
}
