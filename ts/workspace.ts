import Plugin from "broccoli-plugin";
import App from "./app";
import Package from "./package";
import Addon from "./addon";
import { join } from 'path';
import { emptyDirSync, ensureDirSync, readdirSync, ensureSymlinkSync } from 'fs-extra';
import { Memoize } from "typescript-memoize";
import { sync as copyDereference } from "copy-dereference";

// The Workspace represents our directory that will contain a complete Vanilla
// Ember app. It's weird for a broccoli plugin, because we have strong opinions
// about symlinks that don't match Broccoli's. So instead of writing to our own
// assigned (temporary) output directory, we maintain our own final destination
// directory.
//
// It's still important that we particpate in the Brococli dependency graph.
// That is, later stages that depend on us must still include us as an input
// tree, even though they won't actually read from our outputDir as broccoli
// understands it.
//
// Our own broccoli build step is responsible only for assembling the proper
// node_modules structure with all our dependencies in v2 format. It leaves an
// empty place for the app's own code to go, which is filled in later via
// copyIntoApp().
export default class Workspace extends Plugin {
  private didBuild: boolean;
  private destDir: string;
  private app: App;
  private copiedPackages: Set<Addon>;
  private linkedPackages: Set<Addon>;

  constructor(app: App, destDir: string) {
    let copiedPackages = findCopiedPackages(app);
    super([...copiedPackages].map(p => p.vanillaTree), {
      annotation: 'ember-cli-vanilla-workspace',
      persistentOutput: true,
      needsCache: false
    });
    this.app = app;
    this.destDir = destDir;
    this.didBuild = false;
    this.copiedPackages = copiedPackages;
    this.linkedPackages = new Set();
  }

  copyIntoApp(srcDir) {
    copyInto(srcDir, this.app.root);
  }

  build() {
    if (this.didBuild) {
      // TODO: we can selectively allow some addons to rebuild, equivalent to
      // the old isDevelopingAddon.
      return;
    }

    emptyDirSync(this.destDir);

    [...this.copiedPackages].forEach((pkg, index) => {
      pkg.root = this.localPath(pkg.originalRoot);
      copyInto(this.inputPaths[index], pkg.root);
      this.linkNonCopiedDeps(pkg);
    });
    this.app.root = this.localPath(this.app.originalRoot);
    this.linkNonCopiedDeps(this.app);
    this.didBuild = true;
  }

  // the npm structure we're shadowing could have dependency nearly anywhere on
  // disk. We want to maintain their relations to each other. So we must find
  // the point in the filesystem that contains all of them, which could even be
  // "/" (for example, if you npm-linked a dependency that lives in /tmp).
  @Memoize()
  private get commonSegmentCount() {
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

  private localPath(filename) {
    return join(this.destDir, ...pathSegments(filename).slice(this.commonSegmentCount));
  }

  private linkNonCopiedDeps(pkg: Package) {
    for (let dep of pkg.npmDependencies) {
      if (!this.copiedPackages.has(dep) && !this.linkedPackages.has(dep)) {
        this.linkedPackages.add(dep);
        ensureSymlinkSync(dep.originalRoot, this.localPath(dep.originalRoot));
        dep.root = dep.originalRoot;
      }
    }
  }

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

function addToCopySet(copySet: Set<Package>, pkg: Package, app: App) {
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

function pathSegments(filename) {
  let segments = filename.split('/');
  if (segments[0] === '/') {
    segments.shift();
  }
  return segments;
}

function copyInto(srcDir, destDir) {
  ensureDirSync(destDir);
  for (let name of readdirSync(srcDir)) {
    copyDereference(join(srcDir, name), join(destDir, name));
  }
}
