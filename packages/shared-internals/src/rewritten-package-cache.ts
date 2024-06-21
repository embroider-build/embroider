import PackageCache from './package-cache';
import type { V2AddonPackage, V2AppPackage, V2Package } from './package';
import Package from './package';
import { existsSync, readJSONSync, realpathSync } from 'fs-extra';
import { resolve } from 'path';
import { getOrCreate } from './get-or-create';
import { locateEmbroiderWorkingDir } from './working-dir';

export interface RewrittenPackageIndex {
  // keys are paths to original package root directories.
  //
  // values are paths to rewritten directories.
  //
  // all paths are interpreted relative to the rewritten package index file
  // itself.
  packages: Record<string, string>;

  // key is path to the rewritten package that needs to resolve an extra
  // dependency
  //
  // value is list of paths to packages that it should be able to resolve.
  //
  // while the key is always one of our rewritten packages, the values can be
  // rewritten ones or not.
  extraResolutions: Record<string, string[]>;
}

// without this, using a class as an interface forces you to have the same
// private and protected methods too (since people trying to extend from you
// could see all of those)
type PublicAPI<T> = { [K in keyof T]: T[K] };

export class RewrittenPackageCache implements PublicAPI<PackageCache> {
  constructor(private plainCache: PackageCache) {}

  get appRoot(): string {
    return this.plainCache.appRoot;
  }

  resolve(packageName: string, fromPackage: Package): Package {
    // check for any extraResolutions
    let extraResolutions = this.index.extraResolutions.get(fromPackage.root);
    if (extraResolutions) {
      for (let depRoot of extraResolutions) {
        let depPkg = this.plainCache.get(depRoot);
        if (depPkg.name === packageName) {
          return this.maybeMoved(this.withRewrittenDeps(depPkg));
        }
      }
    }

    let resolveFromPkg: Package;
    let oldRoot = this.index.newToOld.get(fromPackage.root);
    if (oldRoot) {
      // the requesting package has been moved, so do the resolving from the old location
      resolveFromPkg = this.plainCache.get(oldRoot);
    } else {
      // the requesting package has not been moved
      resolveFromPkg = fromPackage;
    }

    let oldDest = this.withRewrittenDeps(this.plainCache.resolve(packageName, resolveFromPkg));

    // if the package we found was itself moved return the moved one.
    return this.maybeMoved(oldDest);
  }

  // ensure we have the moved version of the package
  maybeMoved(pkg: Package): Package {
    let newRoot = this.index.oldToNew.get(pkg.root);
    if (newRoot) {
      return this.get(newRoot);
    } else {
      return pkg;
    }
  }

  get(packageRoot: string): Package {
    return this.withRewrittenDeps(this.plainCache.get(packageRoot));
  }

  original(pkg: Package): Package {
    let oldRoot = this.index.newToOld.get(pkg.root);
    if (oldRoot) {
      return this.withRewrittenDeps(this.plainCache.get(oldRoot));
    } else {
      return pkg;
    }
  }

  // given any package, give us a new representation of it where its deps are
  // replaced with rewritten versions of those deps, as needed
  withRewrittenDeps(pkg: Package): Package {
    let found = wrapped.get(pkg);
    if (!found) {
      if (pkg.root === this.index.oldToNew.get(this.appRoot)) {
        // the plain representation of our moved app doesn't know that it's an
        // app, so we instead make a plain Package with isApp set to true
        // explicitly.
        found = new WrappedPackage(this, new Package(pkg.root, this.plainCache, true));
      } else {
        found = new WrappedPackage(this, pkg);
      }
      wrapped.set(pkg, found);
    }
    return castToPackage(found);
  }

  ownerOfFile(filename: string): Package | undefined {
    let owner = this.plainCache.ownerOfFile(filename);
    if (owner) {
      return this.withRewrittenDeps(owner);
    }
  }

  private indexCache:
    | {
        oldToNew: Map<string, string>;
        newToOld: Map<string, string>;
        extraResolutions: Map<string, string[]>;
      }
    | undefined;

  private get index(): {
    oldToNew: Map<string, string>;
    newToOld: Map<string, string>;
    extraResolutions: Map<string, string[]>;
  } {
    if (!this.indexCache) {
      this.indexCache = this.loadIndex();
    }
    return this.indexCache;
  }

  invalidateIndex(): void {
    this.indexCache = undefined;
  }

  private loadIndex(): RewrittenPackageCache['index'] {
    let workingDir = locateEmbroiderWorkingDir(this.appRoot);
    let indexFile = resolve(workingDir, 'rewritten-packages', 'index.json');
    if (!existsSync(indexFile)) {
      return {
        oldToNew: new Map(),
        newToOld: new Map(),
        extraResolutions: new Map(),
      };
    }

    workingDir = realpathSync(workingDir);
    let addonsDir = resolve(workingDir, 'rewritten-packages');

    let { packages, extraResolutions } = readJSONSync(indexFile) as RewrittenPackageIndex;
    return {
      oldToNew: new Map(
        Object.entries(packages).map(([oldRoot, newRoot]) => [resolve(addonsDir, oldRoot), resolve(addonsDir, newRoot)])
      ),
      newToOld: new Map(
        Object.entries(packages).map(([oldRoot, newRoot]) => [resolve(addonsDir, newRoot), resolve(addonsDir, oldRoot)])
      ),
      extraResolutions: new Map(
        Object.entries(extraResolutions).map(([fromRoot, toRoots]) => [
          resolve(addonsDir, fromRoot),
          toRoots.map(r => resolve(addonsDir, r)),
        ])
      ),
    };
  }

  static shared(identifier: string, appRoot: string) {
    let pk = getOrCreate(
      shared,
      identifier + appRoot,
      () => new RewrittenPackageCache(PackageCache.shared(identifier, appRoot))
    );

    // it's not clear that this could ever happen because appRoot is part of the new identifier
    // but it doesn't cost much to leave this code here.
    if (pk.appRoot !== appRoot) {
      throw new Error(`bug: RewrittenPackageCache appRoot disagreement ${appRoot} != ${pk.appRoot}`);
    }
    return pk;
  }
}

const shared: Map<string, RewrittenPackageCache> = new Map();
const wrapped = new WeakMap<Package, WrappedPackage>();

type PackageTheGoodParts = Omit<PublicAPI<Package>, 'nonResolvableDeps'>;

function castToPackage(m: WrappedPackage): Package {
  return m as unknown as Package;
}

class WrappedPackage implements PackageTheGoodParts {
  // Questions about *this* package will be answered based on the given
  // plainPkg.
  //
  // Questions about *this package's deps* will be translated through the set of
  // moved packages.
  //
  // There are two different cases that this enables. The first is when we're
  // representing a package that has itself been rewritten, in which case
  // plainPkg points at the *rewritten* copy of the package, so that we see our
  // own rewritten package.json, etc. The second case is in Stage2 when the
  // dependencies have been rewritten but the app has not -- we represent the
  // app as a WrappedPackage where plainPkg is the *original* app package, so
  // we're still seeing the original package.json, etc, but while also seeing
  // the rewritten addons.
  constructor(private packageCache: RewrittenPackageCache, private plainPkg: Package) {}

  get root() {
    return this.plainPkg.root;
  }

  get name() {
    return this.plainPkg.name;
  }

  get version() {
    return this.plainPkg.version;
  }

  get packageJSON() {
    return this.plainPkg.packageJSON;
  }

  get meta() {
    return this.plainPkg.meta;
  }

  isEmberAddon() {
    return this.plainPkg.isEmberAddon();
  }

  isEngine() {
    return this.plainPkg.isEngine();
  }

  isLazyEngine() {
    return this.plainPkg.isLazyEngine();
  }

  isV2Ember(): this is V2Package {
    return this.plainPkg.isV2Ember();
  }

  isV2App(): this is V2AppPackage {
    return this.plainPkg.isV2App();
  }

  isV2Addon(): this is V2AddonPackage {
    return this.plainPkg.isV2Addon();
  }

  // it's important that we're calling this.dependencies here at this level, not
  // plainPkg.dependencies, which wouldn't be correct
  findDescendants(filter?: (pkg: Package) => boolean): Package[] {
    let pkgs = new Set<Package>();
    let queue: Package[] = [castToPackage(this)];
    while (true) {
      let pkg = queue.shift();
      if (!pkg) {
        break;
      }
      if (!pkgs.has(pkg)) {
        pkgs.add(pkg);
        let nextLevel;
        if (filter) {
          nextLevel = pkg.dependencies.filter(filter);
        } else {
          nextLevel = pkg.dependencies;
        }
        nextLevel.forEach(d => queue.push(d));
      }
    }
    pkgs.delete(castToPackage(this));
    return [...pkgs.values()];
  }

  get mayRebuild() {
    return this.plainPkg.mayRebuild;
  }

  get dependencyNames() {
    return this.plainPkg.dependencyNames;
  }

  get dependencies() {
    return this.plainPkg.dependencyNames
      .map(name => {
        try {
          // this is going through the rewriting-aware resolve in
          // RewrittenPackageCache.
          let dep = this.packageCache.resolve(name, this.plainPkg);

          // and this ensures that regardless of whether the package we found
          // was itself moved, if any of its deps have moved it will see those
          // ones.
          return this.packageCache.withRewrittenDeps(dep);
        } catch (error) {
          // if the package was not found do not error out here. this is relevant
          // for the case where a package might be an optional peerDependency and we dont
          // want to error if it was not found. Additionally, erroring here is "far" away
          // from the actual logical failure point and so not failing here will provide a better
          // error message down the line
          if (error.code === 'MODULE_NOT_FOUND') {
            return false;
          }

          throw error;
        }
      })
      .filter(Boolean) as Package[];
  }

  hasDependency(name: string): boolean {
    // this is *not* extended because it's understood that the rewritten package
    // should explictly list the things that need extraResolutions in its own
    // package.json.ß
    return this.plainPkg.hasDependency(name);
  }

  categorizeDependency(name: string): 'dependencies' | 'devDependencies' | 'peerDependencies' | undefined {
    return this.plainPkg.categorizeDependency(name);
  }
}
