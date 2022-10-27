import { join, sep, isAbsolute } from 'path';
import { ensureSymlinkSync, readdirSync, realpathSync, lstatSync } from 'fs-extra';
import { Memoize } from 'typescript-memoize';
import { PackageCache, Package, getOrCreate } from '@embroider/core';
import { MacrosConfig } from '@embroider/macros/src/node';
import os from 'os';

function assertNoTildeExpansion(source: string, target: string) {
  if (target.includes('~') && os.platform() !== 'win32') {
    throw new Error(
      `The symbolic link: ${source}'s target: ${target} contained a bash expansion '~' which is not supported.`
    );
  }
}
export class MovablePackageCache extends PackageCache {
  constructor(private macrosConfig: MacrosConfig, appRoot: string) {
    super(appRoot);
  }

  moveAddons(destDir: string): MovedPackageCache {
    // start with the plain old app package
    let origApp = this.get(this.appRoot);

    // discover the set of all packages that will need to be moved into the
    // workspace
    let movedSet = new MovedSet(origApp);

    return new MovedPackageCache(this.rootCache, this.resolutionCache, destDir, movedSet, origApp, this.macrosConfig);
  }
}

export class MovedPackageCache extends PackageCache {
  readonly app!: Package;
  private commonSegmentCount: number;
  readonly moved: Map<Package, Package> = new Map();
  readonly unmovedAddons: Set<Package>;

  constructor(
    rootCache: PackageCache['rootCache'],
    resolutionCache: PackageCache['resolutionCache'],
    private destDir: string,
    movedSet: MovedSet,
    private origApp: Package,
    private macrosConfig: MacrosConfig
  ) {
    // this is the initial appRoot, which we can't know until just below here
    super('not-the-real-root');

    // that gives us our common segment count, which enables localPath mapping
    this.commonSegmentCount = movedSet.commonSegmentCount;

    // so we can now determine where the app will go inside the workspace. THIS
    // is where we fix 'not-the-real-root' from above.
    this.appRoot = this.localPath(origApp.root);

    this.macrosConfig.packageMoved(origApp.root, this.appRoot);

    for (let originalPkg of movedSet.packages) {
      // Update our rootCache so we don't need to rediscover moved packages
      let movedPkg;
      if (originalPkg === origApp) {
        // this wraps the original app package with one that will use moved
        // dependencies. The app itself hasn't moved yet, which is why a proxy
        // is needed at this level.
        movedPkg = packageProxy(origApp, (pkg: Package) => this.moved.get(pkg) || pkg);
        this.app = movedPkg;
        rootCache.set(movedPkg.root, movedPkg);
      } else {
        movedPkg = this.movedPackage(originalPkg);
        this.moved.set(originalPkg, movedPkg);
        this.macrosConfig.packageMoved(originalPkg.root, movedPkg.root);
      }

      // Update our resolutionCache so we still know as much about the moved
      // packages as we did before we moved them, without redoing package
      // resolution.
      let resolutions = new Map();
      for (let dep of originalPkg.dependencies) {
        if (movedSet.packages.has(dep)) {
          resolutions.set(dep.name, this.movedPackage(dep));
        } else {
          resolutions.set(dep.name, dep);
        }
      }
      resolutionCache.set(movedPkg, resolutions);
    }
    this.rootCache = rootCache;
    this.resolutionCache = resolutionCache;
    this.unmovedAddons = movedSet.unmovedAddons;
  }

  private movedPackage(originalPkg: Package): Package {
    let newRoot = this.localPath(originalPkg.root);
    return getOrCreate(this.rootCache, newRoot, () => new (originalPkg.constructor as any)(newRoot, this, false));
  }

  private localPath(filename: string) {
    return join(this.destDir, ...pathSegments(filename).slice(this.commonSegmentCount));
  }

  // hunt for symlinks that may be needed to do node_modules resolution from the
  // given path.
  async updatePreexistingResolvableSymlinks(): Promise<void> {
    let roots = this.originalRoots();
    [...this.candidateDirs()].map(path => {
      let links = symlinksInNodeModules(path);
      for (let { source, target } of links) {
        let pkg = roots.get(target);
        if (pkg) {
          // we found a symlink that points at a package that was copied.
          // Replicate it in the new structure pointing at the new package.
          ensureSymlinkSync(pkg.root, this.localPath(source));
        }
      }
    });
  }

  // places that might have symlinks we need to mimic
  private candidateDirs(): Set<string> {
    let candidates = new Set() as Set<string>;
    let originalPackages = [this.origApp, ...this.moved.keys()];
    for (let pkg of originalPackages) {
      let segments = pathSegments(pkg.root);

      let candidate = join(pkg.root, 'node_modules');
      candidates.add(candidate);

      for (let i = segments.length - 1; i >= this.commonSegmentCount; i--) {
        if (segments[i - 1] !== 'node_modules') {
          let candidate = '/' + join(...segments.slice(0, i), 'node_modules');
          if (candidates.has(candidate)) {
            break;
          }
          candidates.add(candidate);
        }
      }
    }
    return candidates;
  }

  private originalRoots(): Map<string, Package> {
    let originalRoots = new Map();
    for (let [originalPackage, movedPackage] of this.moved.entries()) {
      originalRoots.set(originalPackage.root, movedPackage);
    }
    return originalRoots;
  }
}

function maybeReaddirSync(path: string) {
  try {
    return readdirSync(path);
  } catch (err) {
    if (err.code !== 'ENOTDIR' && err.code !== 'ENOENT') {
      throw err;
    }
    return [];
  }
}

function isSymlink(path: string): boolean {
  try {
    let stat = lstatSync(path);
    return stat.isSymbolicLink();
  } catch (err) {
    if (err.code !== 'ENOTDIR' && err.code !== 'ENOENT') {
      throw err;
    }

    return false;
  }
}

function symlinksInNodeModules(path: string): { source: string; target: string }[] {
  let results: { source: string; target: string }[] = [];

  // handles the full `node_modules` being symlinked (this is uncommon, but sometimes
  // be useful for test harnesses to avoid multiple `npm install` invocations)
  let parentIsSymlink = isSymlink(path);

  let names = maybeReaddirSync(path);

  names.map(name => {
    let source = join(path, name);
    let stats = lstatSync(source);
    if (parentIsSymlink || stats.isSymbolicLink()) {
      let target = realpathSync(source);
      assertNoTildeExpansion(source, target);

      results.push({ source, target });
    } else if (stats.isDirectory() && name.startsWith('@')) {
      // handle symlinked scope names (e.g. symlinking `@myorghere` to a shared location)
      let isSourceSymlink = isSymlink(source);
      let innerNames = maybeReaddirSync(source);

      innerNames.map(innerName => {
        let innerSource = join(source, innerName);
        let innerStats = lstatSync(innerSource);
        if (parentIsSymlink || isSourceSymlink || innerStats.isSymbolicLink()) {
          let target = realpathSync(innerSource);
          assertNoTildeExpansion(innerSource, target);

          results.push({ source: innerSource, target });
        }
      });
    }
  });

  return results;
}

function pathSegments(filename: string) {
  let segments = filename.split(sep);
  if (isAbsolute(filename)) {
    segments.shift();
  }
  return segments;
}

class MovedSet {
  private mustMove: Map<Package, boolean> = new Map();
  unmovedAddons: Set<Package> = new Set();

  constructor(private app: Package) {
    this.check(app);
  }

  private check(pkg: Package): boolean {
    if (this.mustMove.has(pkg)) {
      return this.mustMove.get(pkg)!;
    }

    // non-ember packages don't need to move
    if (pkg !== this.app && !pkg.isEmberPackage()) {
      this.mustMove.set(pkg, false);
      return false;
    }

    let mustMove =
      // The app always moves (because we need a place to mash all the
      // addon-provided "app-js" trees),
      pkg === this.app ||
      // For the same reason, engines need to move (we need a place to mash all
      // their child addon's provided app-js trees into)
      pkg.isEngine() ||
      //  any other ember package that isn't native v2 must move because we've
      //  got to rewrite them
      !pkg.isV2Ember();

    // this is a partial answer. After we check our children, our own `mustMove`
    // may change from false to true. But it's OK that our children see false in
    // that case, because they don't need to move on our behalf.
    //
    // We need to already be in the `this.mustMove` cache at this moment in
    // order to avoid infinite recursion if any of our children end up depending
    // back on us.
    this.mustMove.set(pkg, mustMove);

    for (let dep of pkg.dependencies) {
      // or if any of your deps need to move
      mustMove = this.check(dep) || mustMove;
    }
    this.mustMove.set(pkg, mustMove);

    if (!mustMove) {
      this.unmovedAddons.add(pkg);
    }

    return mustMove;
  }

  @Memoize()
  get packages(): Set<Package> {
    let result = new Set() as Set<Package>;
    for (let [pkg, mustMove] of this.mustMove) {
      if (mustMove) {
        result.add(pkg);
      }
    }
    return result;
  }

  // the npm structure we're shadowing could have a dependency nearly anywhere
  // on disk. We want to maintain their relations to each other. So we must find
  // the point in the filesystem that contains all of them, which could even be
  // "/" (for example, if you npm-linked a dependency that lives in /tmp).
  //
  // The commonSegmentCount is how many leading path segments are shared by all
  // our packages.
  @Memoize()
  get commonSegmentCount(): number {
    return [...this.packages].reduce((longestPrefix, pkg) => {
      let candidate = pathSegments(pkg.root);
      let shorter, longer;
      if (longestPrefix.length > candidate.length) {
        shorter = candidate;
        longer = longestPrefix;
      } else {
        shorter = longestPrefix;
        longer = candidate;
      }
      let i = 0;
      for (; i < shorter.length; i++) {
        if (shorter[i] !== longer[i]) {
          break;
        }
      }
      return shorter.slice(0, i);
    }, pathSegments(this.app.root)).length;
  }
}

function packageProxy(pkg: Package, getMovedPackage: (pkg: Package) => Package) {
  let p: Package = new Proxy(pkg, {
    get(pkg: Package, prop: string | number | symbol) {
      if (prop === 'dependencies') {
        return pkg.dependencies.map(getMovedPackage);
      }
      if (prop === 'nonResolvableDeps') {
        if (!pkg.nonResolvableDeps) {
          return pkg.nonResolvableDeps;
        }
        return new Map([...pkg.nonResolvableDeps.values()].map(dep => [dep.name, getMovedPackage(dep)]));
      }
      if (prop === 'findDescendants') {
        return pkg.findDescendants.bind(p);
      }
      return (pkg as any)[prop];
    },
  });
  return p;
}
