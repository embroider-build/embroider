import BasicPackage from "./basic-package";
import Package from './package';
import { realpathSync } from 'fs';
import { getOrCreate } from './get-or-create';
import resolve from 'resolve';
import { join, dirname } from 'path';
import { sync as pkgUpSync }  from 'pkg-up';

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
  protected resolutionCache: Map<Package, Map<string, Package>> = new Map();

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

  getAddon(packageRoot: string) {
    return this.getPackage(packageRoot, true);
  }

  ownerOfFile(filename: string): Package | undefined {
    let segments = filename.split('/');

    // first we look through our cached packages for any that are rooted right
    // at or above the file.
    for (let length = segments.length - 1; length >= 0; length--) {
      if (segments[length-1] === 'node_modules') {
        // once we hit a node_modules, we're leaving the package we were in, so
        // any higher caches don't apply to us
        break;
      }
      let candidate = segments.slice(0, length).join('/');
      if (this.rootCache.has(candidate)) {
        return this.rootCache.get(candidate);
      }
    }

    let packageJSONPath = pkgUpSync(filename);
    if (packageJSONPath) {
      return this.getAddon(dirname(packageJSONPath));
    }
  }

}
