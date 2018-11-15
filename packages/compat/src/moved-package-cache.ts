import { join, dirname, resolve } from 'path';
import {
  ensureSymlinkSync,
  readdir,
  readlink,
  realpath,
} from 'fs-extra';
import { Memoize } from "typescript-memoize";
import V1InstanceCache from "./v1-instance-cache";
import { PackageCache, Package } from "@embroider/core";
import MovedPackage from './moved-package';
import MovingApp from './moving-app';

export default class MovedPackageCache extends PackageCache {
  private moved: Map<Package, MovedPackage | MovingApp> = new Map();
  private reverseMoved: Map<MovedPackage | MovingApp, Package> = new Map();

  static create(
    originalPackageCache: PackageCache,
    app: Package,
    destDir: string,
    v1Cache: V1InstanceCache
  ): MovedPackageCache {
    let movedSet = new MovedSet(originalPackageCache, app);
    return new this(movedSet.packages, originalPackageCache, app, movedSet.commonSegmentCount, destDir, v1Cache);
  }

  private constructor(
    movedPackages: Set<Package>,
    private originalPackageCache: PackageCache,
    private origApp: Package,
    private commonSegmentCount: number,
    private destDir: string,
    v1Cache: V1InstanceCache
  ) {
    super();

    for (let originalPkg of movedPackages) {
      let movedPkg;
      if (originalPkg === origApp) {
        movedPkg = new MovingApp(this, this.localPath(originalPkg.root), originalPkg);
      } else {
        movedPkg = new MovedPackage(this, this.localPath(originalPkg.root), originalPkg, v1Cache);
      }
      this.moved.set(originalPkg, movedPkg);
      this.reverseMoved.set(movedPkg, originalPkg);
    }
  }

  getApp(inputRoot: string) : Package {
    return this.maybeMoved(this.originalPackageCache.getApp(inputRoot));
  }

  resolve(packageName: string, fromPackage: Package): Package {
    fromPackage = this.maybeOriginal(fromPackage);
    return this.maybeMoved(this.originalPackageCache.resolve(packageName, fromPackage));
  }

  packagesThatDependOn(pkg: Package) {
    pkg = this.maybeOriginal(pkg);
    return new Set([...this.originalPackageCache.packagesThatDependOn(pkg)].map(pkg => this.maybeMoved(pkg)));
  }

  private localPath(filename: string) {
    return join(this.destDir, ...pathSegments(filename).slice(this.commonSegmentCount));
  }

  private maybeMoved(pkg: Package) {
    if (pkg && this.moved.has(pkg)) {
      return this.moved.get(pkg)!;
    }
    return pkg;
  }

  private maybeOriginal(pkg: Package) {
    if (pkg instanceof MovedPackage && this.reverseMoved.has(pkg)) {
      return this.reverseMoved.get(pkg)!;
    }
    return pkg;
  }

  @Memoize()
  get all(): [Package, MovedPackage][] {
    let output: [Package, MovedPackage][] = [];
    for (let [orig, moved] of this.moved.entries()) {
      // we leave the app out here, because we don't _actually_ want to do any
      // copying of app files into the workspace. That is not our responsibility
      // -- we're just supposed to be getting all the dependencies ready.
      if (!(moved instanceof MovingApp)) {
        output.push([orig, moved]);
      }
    }
    return output;
  }

  get app(): MovingApp {
    return this.moved.get(this.origApp) as MovingApp;
  }

  // hunt for symlinks that may be needed to do node_modules resolution from the
  // given path, going up a maximum of `depth` levels.
  async updatePreexistingResolvableSymlinks(): Promise<void> {
    let roots = this.originalRoots();
    await Promise.all([...this.candidateDirs()].map(async path => {
      let links = await symlinksInDir(path);
      for (let { source, target } of links) {
        let realTarget = await realpath(resolve(dirname(source), target));
        let pkg = roots.get(realTarget);
        if (pkg) {
          // we found a symlink that points at a package that was copied.
          // Replicate it in the new structure pointing at the new package.
          ensureSymlinkSync(pkg.root, this.localPath(source));
        }
      }
    }));
  }

  // places that might have symlinks we need to mimic
  private candidateDirs(): Set<string> {
    let candidates = new Set();
    for (let pkg of this.moved.keys()) {
      let segments = pathSegments(pkg.root);
      for (let i = segments.length - 1; i >= this.commonSegmentCount; i--) {
        if (segments[i-1] !== 'node_modules') {
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

  private originalRoots() {
    let originalRoots = new Map();
    for (let [originalPackage, movedPackage] of this.moved.entries()) {
      originalRoots.set(originalPackage.root, movedPackage);
    }
    return originalRoots;
  }
}

async function symlinksInDir(path: string): Promise<{ source: string, target: string }[]> {
  let names;
  try {
    names = await readdir(path);
  } catch (err) {
    if (err.code !== 'ENOTDIR' && err.code !== 'ENOENT') {
      throw err;
    }
    return [];
  }
  let results = await Promise.all(names.map(async name => {
    let source = join(path, name);
    try {
      let target = await readlink(source);
      return { source, target };
    } catch (err) {
      if (err.code !== 'EINVAL') {
        throw err;
      }
    }
  }));
  return results.filter(Boolean) as { source: string, target: string }[];
}

function pathSegments(filename: string) {
  let segments = filename.split('/');
  if (segments[0] === '/') {
    segments.shift();
  }
  return segments;
}

class MovedSet {
  packages: Set<Package> = new Set();

  constructor(private originalPackageCache: PackageCache, private app: Package) {
    for (let dep of app.findDescendants(pkg => pkg.isEmberPackage).reverse()) {
      if (!dep.isNativeV2) {
        // Non-native-v2 dependencies need to move into the workspace
        this.move(dep);
      }
    }
    // even if all our deps are native v2, the app itself always moves.
    this.move(app);
  }

  private move(pkg: Package) {
    if (this.packages.has(pkg)) {
      return;
    }
    this.packages.add(pkg);
    for (let nextLevelPackage of this.originalPackageCache.packagesThatDependOn(pkg)) {
      // packages that depend on a copied package also need to be moved
      this.move(nextLevelPackage);
    }
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
