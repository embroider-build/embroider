import BasicPackage from "./basic-package";
import Package from './package';
import { realpathSync } from 'fs';
import { getOrCreate } from './get-or-create';
import resolve from 'resolve';
import { join, dirname } from 'path';

export default class PackageCache {
  resolve(packageName: string, fromPackage: Package): Package {
    let cache = getOrCreate(this.resolutionCache, fromPackage, () => new Map());
    return getOrCreate(cache, packageName, () => {
      let root = dirname(resolve.sync(join(packageName, 'package.json'), { basedir: this.basedir(fromPackage) }));
      return this.getAddon(root);
    });
  }

  getApp(packageRoot: string) {
    return this.getPackage(packageRoot, false);
  }

  protected rootCache: Map<string, Package> = new Map();
  protected resolutionCache: WeakMap<Package, Map<string, Package>> = new WeakMap();

  protected basedir(pkg: Package): string {
    return pkg.root;
  }

  private getPackage(packageRoot: string, isAddon: boolean): Package {
    let root = realpathSync(packageRoot);
    let p = getOrCreate(this.rootCache, root, () => {
      return new BasicPackage(root, !isAddon, this);
    });
    return p;
  }

  private getAddon(packageRoot: string) {
    return this.getPackage(packageRoot, true);
  }

}
