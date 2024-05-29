import Package from './package';
import { existsSync, realpathSync } from 'fs';
import { getOrCreate } from './get-or-create';
import resolvePackagePath from 'resolve-package-path';
import { basename, dirname, join, resolve } from 'path';

const realpathSyncCache = new Map<string, string>();

function getCachedRealpath(path: string): string {
  let cached = realpathSyncCache.get(path);
  if (cached) {
    return cached;
  }

  let root = realpathSync(path);
  realpathSyncCache.set(path, root);
  return root;
}

const existsCache = new Map<string, boolean>();

function getCachedExists(path: string): boolean {
  if (existsCache.has(path)) {
    const cachedExists = existsCache.get(path);
    if (cachedExists !== undefined) {
      return cachedExists;
    }
  }

  const exists = existsSync(path);
  existsCache.set(path, exists);
  return exists;
}

export default class PackageCache {
  constructor(public appRoot: string) {}

  resolve(packageName: string, fromPackage: Package): Package {
    let cache = getOrCreate(this.resolutionCache, fromPackage, () => new Map() as Map<string, Package | null>);
    let result = getOrCreate(cache, packageName, () => {
      // the type cast is needed because resolvePackagePath itself is erroneously typed as `any`.
      let packagePath = resolvePackagePath(packageName, fromPackage.root) as string | null;
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

  private rootCache: Map<string, Package> = new Map();
  private resolutionCache: Map<Package, Map<string, Package | null>> = new Map();

  get(packageRoot: string) {
    let root = getCachedRealpath(packageRoot);
    let p = getOrCreate(this.rootCache, root, () => {
      return new Package(root, this, root === this.appRoot);
    });
    return p;
  }

  ownerOfFile(filename: string): Package | undefined {
    let candidate = filename;
    const virtualPrefix = 'embroider_virtual:';

    if (candidate.includes(virtualPrefix)) {
      candidate = candidate.replace(/^.*embroider_virtual:/, '');
    }

    // first we look through our cached packages for any that are rooted right
    // at or above the file.
    while (true) {
      if (basename(candidate) === 'node_modules') {
        // once we hit a node_modules, we're leaving the
        // package we were in, so any higher caches don't apply to us
        break;
      }

      if (this.rootCache.has(candidate)) {
        return this.rootCache.get(candidate);
      }
      if (getCachedExists(join(candidate, 'package.json'))) {
        return this.get(candidate);
      }
      let nextCandidate = resolve(candidate, '..');
      if (nextCandidate === candidate) {
        // got to the top
        break;
      }
      candidate = nextCandidate;
    }
  }

  static shared(identifier: string, appRoot: string) {
    let pk = getOrCreate(shared, identifier + appRoot, () => new PackageCache(appRoot));

    // it's not clear that this could ever happen because appRoot is part of the new identifier
    // but it doesn't cost much to leave this code here.
    if (pk.appRoot !== appRoot) {
      throw new Error(`bug: PackageCache appRoot disagreement ${appRoot}!=${pk.appRoot}`);
    }
    return pk;
  }
}

const shared: Map<string, PackageCache> = new Map();
