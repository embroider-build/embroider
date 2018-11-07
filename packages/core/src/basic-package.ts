import { Memoize } from 'typescript-memoize';
import { join, dirname } from 'path';
import PackageCache from './package-cache';
import flatMap from 'lodash/flatMap';
import resolve from 'resolve';
import Package from './package';

export default class BasicPackage extends Package {
  private dependencyKeys: string[];

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
    return names.map(name => {
      let addonRoot = dirname(resolve.sync(join(name, 'package.json'), { basedir: this.root }));
      return this.packageCache.getPackage(addonRoot, this);
    }).filter(Boolean);
  }
}
