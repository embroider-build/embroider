import Package from './package';
import DummyPackage from './dummy-package';
import { existsSync, realpathSync } from 'fs';
import { getOrCreate } from './get-or-create';
import resolvePackagePath from 'resolve-package-path';
import { dirname, sep } from 'path';

// This is here so that in the happy future day when we can drop support for
// dummy apps it will be obvious what code to delete.
const SUPPORT_DUMMY_APPS = true;

export default class PackageCache {
  constructor(public appRoot: string) {}

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

  protected rootCache: Map<string, Package> = new Map();
  protected resolutionCache: Map<Package, Map<string, Package | null>> = new Map();

  basedir(pkg: Package): string {
    return pkg.root;
  }

  get(packageRoot: string) {
    let root = realpathSync(packageRoot);
    let p = getOrCreate(this.rootCache, root, () => {
      return new Package(root, this, root === this.appRoot);
    });
    return p;
  }

  ownerOfFile(filename: string): Package | undefined {
    let segments = filename.split(sep);

    // first we look through our cached packages for any that are rooted right
    // at or above the file.
    for (let length = segments.length; length >= 0; length--) {
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
      } else if (SUPPORT_DUMMY_APPS && candidate === this.appRoot) {
        // we were given an appRoot that doesn't have a package.json. This can
        // happen in classic builds with a dummy app.
        let owningAddon = this.ownerOfFile(segments.slice(0, length - 1).join(sep));
        if (!owningAddon) {
          throw new Error(
            `bug: PackageCache was given appRoot=${this.appRoot}, which does not have a package.json and doesn't appear to be a dummy app`
          );
        }
        let pkg = new DummyPackage(candidate, owningAddon, this);
        this.rootCache.set(candidate, pkg);
        return pkg;
      }
    }
  }

  // register to be shared as the per-process package cache with the given name
  shareAs(identifier: string) {
    shared.set(identifier, this);
  }

  static shared(identifier: string, appRoot: string) {
    return getOrCreate(shared, identifier, () => new PackageCache(appRoot));
  }
}

const shared: Map<string, PackageCache> = new Map();
