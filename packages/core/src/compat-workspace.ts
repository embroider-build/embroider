import Plugin from "broccoli-plugin";
import App from "./app";
import CompatPackage from "./compat-package";
import Addon from "./addon";
import { join, dirname, resolve } from 'path';
import {
  emptyDirSync,
  readdirSync,
  ensureSymlinkSync,
  readdir,
  readlink,
  realpath,
  removeSync,
  copySync,
} from 'fs-extra';
import { Memoize } from "typescript-memoize";
import Workspace from './workspace';

export default class CompatWorkspace extends Plugin implements Workspace {
  private didBuild: boolean;
  private destDir: string;
  private app: App;
  private copiedPackages: Set<Addon>;
  private linkedPackages: Set<Addon>;

  constructor(app: App, destDir: string) {
    let copiedPackages = findCopiedPackages(app);
    super([...copiedPackages].map(p => p.vanillaTree), {
      annotation: 'embroider:core:workspace',
      persistentOutput: true,
      needsCache: false
    });
    this.app = app;
    this.destDir = destDir;
    this.didBuild = false;
    this.copiedPackages = copiedPackages;
    this.linkedPackages = new Set();
  }

  clearApp() {
    for (let name of readdirSync(this.app.root)) {
      if (name !== 'node_modules') {
        removeSync(join(this.app.root, name));
      }
    }
  }

  copyIntoApp(srcDir: string) {
    copySync(srcDir, this.app.root, { dereference: true });
  }

  async build() {
    if (this.didBuild) {
      // TODO: we can selectively allow some addons to rebuild, equivalent to
      // the old isDevelopingAddon.
      return;
    }

    emptyDirSync(this.destDir);

    [...this.copiedPackages].forEach((pkg, index) => {
      pkg.root = this.localPath(pkg.originalRoot);
      copySync(this.inputPaths[index], pkg.root, { dereference: true });
      this.linkNonCopiedDeps(pkg);
    });
    this.app.root = this.localPath(this.app.originalRoot);
    this.linkNonCopiedDeps(this.app);

    await this.updatePreexistingResolvableSymlinks();

    this.didBuild = true;
  }

  // the npm structure we're shadowing could have dependency nearly anywhere on
  // disk. We want to maintain their relations to each other. So we must find
  // the point in the filesystem that contains all of them, which could even be
  // "/" (for example, if you npm-linked a dependency that lives in /tmp).
  @Memoize()
  private get commonSegmentCount(): number {
    return [...this.copiedPackages].reduce((longestPrefix, pkg) => {
      let candidate = pathSegments(pkg.originalRoot);
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
    }, pathSegments(this.app.originalRoot)).length;
  }

  private localPath(filename: string) {
    return join(this.destDir, ...pathSegments(filename).slice(this.commonSegmentCount));
  }

  private linkNonCopiedDeps(pkg: CompatPackage) {
    for (let dep of pkg.npmDependencies) {
      if (!this.copiedPackages.has(dep)) {
        ensureSymlinkSync(dep.originalRoot, join(pkg.root, 'node_modules', dep.originalPackageJSON.name));
        if (!this.linkedPackages.has(dep)) {
          this.linkedPackages.add(dep);
          dep.root = dep.originalRoot;
        }
      }
    }
  }

  @Memoize()
  private get originalRoots() {
    let originalRoots = new Map();
    [...this.copiedPackages].forEach(pkg => originalRoots.set(pkg.originalRoot, pkg));
    return originalRoots;
  }

  // hunt for symlinks that may be needed to do node_modules resolution from the
  // given path, going up a maximum of `depth` levels.
  private async updatePreexistingResolvableSymlinks() {
    let candidates = new Set();
    for (let pkg of [this.app, ...this.copiedPackages]) {
      let segments = pathSegments(pkg.originalRoot);
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
    await Promise.all([...candidates].map(async path => {
      let links = await symlinksInDir(path);
      for (let { source, target } of links) {
        let realTarget = await realpath(resolve(dirname(source), target));
        let pkg = this.originalRoots.get(realTarget);
        if (pkg) {
          // we found a symlink that points at a package that was copied.
          // Replicate it in the new structure pointing at the new package.
          ensureSymlinkSync(pkg.root, this.localPath(source));
        }
      }
    }));
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

function findCopiedPackages(app: App): Set<Addon> {
  let needsCopy: Set<Addon> = new Set();
  for (let dep of app.descendants.reverse()) {
    if (!dep.isNativeV2) {
      // Non-native-v2 dependencies need to be copied into the workspace
      addToCopySet(needsCopy, dep, app);
    }
  }
  return needsCopy;
}

function addToCopySet(copySet: Set<CompatPackage>, pkg: CompatPackage, app: App) {
  if (copySet.has(pkg)) {
    return;
  }
  copySet.add(pkg);
  for (let nextLevelPackage of pkg.dependedUponBy) {
    if (nextLevelPackage !== app) {
      // packages that depend on a copied package also need to be copied
      addToCopySet(copySet, nextLevelPackage, app);
    }
  }
}

function pathSegments(filename: string) {
  let segments = filename.split('/');
  if (segments[0] === '/') {
    segments.shift();
  }
  return segments;
}
