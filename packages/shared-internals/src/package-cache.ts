import Package from './package';
import { existsSync, realpathSync } from 'fs';
import { getOrCreate } from './get-or-create';
import resolvePackagePath from 'resolve-package-path';
import { dirname, sep } from 'path';

export default class PackageCache {
  resolve(packageName: string, fromPackage: Package): Package {
    let cache = getOrCreate(this.resolutionCache, fromPackage, () => new Map() as Map<string, Package | null>);
    let result = getOrCreate(cache, packageName, () => {
      // the type cast is needed because resolvePackagePath itself is erroneously typed as `any`.
      let packagePath = resolvePackagePath(packageName, this.basedir(fromPackage)) as string | null;
      if (!packagePath) {
        // this gets our null into the cache so we don't keep trying to resolve
        // a thing that is not found
        return null;
      }
      return this.get(dirname(packagePath));
    });
    if (!result) {
      let e = new Error(`unable to resolve package ${packageName} from ${fromPackage.root}`);
      (e as any).code = 'MODULE_NOT_FOUND';
      throw e;
    }
    return result;
  }

  getApp(packageRoot: string) {
    let root = realpathSync(packageRoot);
    let p = getOrCreate(this.rootCache, root, () => {
      return new Package(root, this, true);
    });
    return p;
  }

  seed(pkg: Package) {
    if (this.rootCache.has(pkg.root)) {
      throw new Error(`bug: tried to seed package ${pkg.name} but it's already in packageCache`);
    }
    this.rootCache.set(pkg.root, pkg);
  }

  protected rootCache: Map<string, Package> = new Map();
  protected resolutionCache: Map<Package, Map<string, Package | null>> = new Map();

  basedir(pkg: Package): string {
    return pkg.root;
  }

  get(packageRoot: string) {
    let root = realpathSync(packageRoot);
    let p = getOrCreate(this.rootCache, root, () => {
      return new Package(root, this);
    });
    return p;
  }

  ownerOfFile(filename: string): Package | undefined {
    let segments = filename.split(sep);

    // first we look through our cached packages for any that are rooted right
    // at or above the file.
    for (let length = segments.length - 1; length >= 0; length--) {
      if (segments[length - 1] === 'node_modules') {
        // once we hit a node_modules, we're leaving the package we were in, so
        // any higher caches don't apply to us
        break;
      }

      let usedSegments = segments.slice(0, length);
      let candidate = usedSegments.join(sep);
      if (this.rootCache.has(candidate)) {
        return this.rootCache.get(candidate);
      }
      if (existsSync([...usedSegments, 'package.json'].join(sep))) {
        return this.get(candidate);
      }
    }
  }

  // register to be shared as the per-process package cache with the given name
  shareAs(identifier: string) {
    shared.set(identifier, this);
  }

  static shared(identifier: string) {
    return getOrCreate(shared, identifier, () => new PackageCache());
  }
}

const shared: Map<string, PackageCache> = new Map();
