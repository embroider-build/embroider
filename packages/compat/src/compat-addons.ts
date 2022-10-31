import { Node } from 'broccoli-node-api';
import { join, relative, dirname, isAbsolute, sep } from 'path';
import { emptyDirSync, ensureSymlinkSync, ensureDirSync, realpathSync, copySync, writeJSONSync } from 'fs-extra';
import { Stage, Package, PackageCache, WaitForTrees, mangledEngineRoot } from '@embroider/core';
import V1InstanceCache from './v1-instance-cache';
import { MovedPackageCache } from './moved-package-cache';
import { Memoize } from 'typescript-memoize';
import buildCompatAddon from './build-compat-addon';
import Options, { optionsWithDefaults } from './options';
import V1App from './v1-app';
import TreeSync from 'tree-sync';
import { WatchedDir } from 'broccoli-source';

// This build stage expects to be run with broccoli memoization enabled in order
// to get good rebuild performance. We turn it on by default here, but you can
// still explicitly turn it off by setting the env var to "false".
//
// As for safetly mutating process.env: broccoli doesn't read this until a Node
// executes its build hook, so as far as I can tell there's no way we could set
// this too late.
if (typeof process.env.BROCCOLI_ENABLED_MEMOIZE === 'undefined') {
  process.env.BROCCOLI_ENABLED_MEMOIZE = 'true';
}

export default class CompatAddons implements Stage {
  private didBuild = false;
  private destDir: string;
  private packageCache: MovedPackageCache;
  private treeSyncMap: WeakMap<Package, TreeSync>;
  private v1Cache: V1InstanceCache;
  readonly inputPath: string;

  constructor(legacyEmberAppInstance: object, maybeOptions?: Options) {
    let options = optionsWithDefaults(maybeOptions);
    let v1Cache = V1InstanceCache.forApp(legacyEmberAppInstance, options);

    // we want this to be stable across builds, because it becomes part of the
    // path to all of the files that the stage3 packager sees, and we want to
    // benefit from on-disk caching in stage3 packagers.
    ensureDirSync(options.workspaceDir!);
    this.destDir = realpathSync(options.workspaceDir!);

    this.packageCache = v1Cache.app.packageCache.moveAddons(this.destDir);
    this.inputPath = v1Cache.app.root;
    this.treeSyncMap = new WeakMap();
    this.v1Cache = v1Cache;
  }

  get tree(): Node {
    let movedAddons = [...this.packageCache.moved.keys()].map(oldPkg => buildCompatAddon(oldPkg, this.v1Cache));

    // these get watched so that EMBROIDER_REBUILD_ADDONS will still work
    // correctly, even for v2 addons that have no v1 addon deps and therefore
    // don't need to be moved. We don't consume these trees in our build step,
    // we only do this to trigger rebuilds to happen.
    let watchedUnmovedAddons = [...this.packageCache.unmovedAddons]
      .filter(pkg => pkg.mayRebuild)
      .map(pkg => new WatchedDir(pkg.root));

    let { synthVendor, synthStyles } = this.getSyntheticPackages(this.v1Cache.app, movedAddons);
    return new WaitForTrees(
      { movedAddons, synthVendor, synthStyles, watchedUnmovedAddons },
      '@embroider/compat/addons',
      this.build.bind(this)
    );
  }

  async ready(): Promise<{ outputPath: string; packageCache: PackageCache }> {
    await this.deferReady.promise;
    writeJSONSync(join(this.destDir, '.embroider-reuse.json'), {
      appDestDir: relative(this.destDir, this.packageCache.appRoot),
    });
    return {
      outputPath: this.packageCache.appRoot,
      packageCache: this.packageCache,
    };
  }

  private get appDestDir(): string {
    return this.packageCache.appRoot;
  }

  private get app(): Package {
    return this.packageCache.app;
  }

  private async build(
    {
      movedAddons,
      synthVendor,
      synthStyles,
    }: {
      movedAddons: string[];
      synthVendor: string;
      synthStyles: string;
    },
    changedMap: Map<string, boolean>
  ) {
    // empty the directory only on the first pass
    if (!this.didBuild) {
      emptyDirSync(this.destDir);
    }

    [...this.packageCache.moved.entries()].forEach(([oldPkg, newPkg], index) => {
      let treeInstance = this.treeSyncMap.get(newPkg);

      // we need to pull metadata off the oldPkg, not the newPkg, because the
      // newPkg doesn't actually have anything in it yet (including
      // package.json)
      let isEngine = oldPkg.isEngine();

      // Engines get built not into their real package name, but a mangled one.
      // Their real one needs to be free for us to merge all their dependencies
      // into.
      let destination = isEngine ? mangledEngineRoot(newPkg) : newPkg.root;

      if (!treeInstance) {
        let ignore = ['**/node_modules'];

        let rel = relative(destination, this.appDestDir);
        if (!rel.startsWith('..') && !isAbsolute(rel)) {
          // the app is inside our addon. We must not copy the app as part of
          // the addon, because that would overwrite the real app build.
          ignore.push(rel);

          if (rel === `tests${sep}dummy`) {
            // special case: classic dummy apps are weird because they put the
            // tests (which are truly part of the app, not the addon) inside the
            // addon instead of inside the app.
            ignore.push('tests');
          }
        }

        treeInstance = new TreeSync(movedAddons[index], destination, {
          ignore,
        });

        this.treeSyncMap.set(newPkg, treeInstance);
      }

      if (
        !this.didBuild || // always copy on the first build
        (newPkg.mayRebuild && changedMap.get(movedAddons[index]))
      ) {
        treeInstance.sync();
        if (!this.didBuild && isEngine) {
          // The first time we encounter an engine, we also create the empty
          // shell for its real module namespace.
          copySync(join(destination, 'package.json'), join(newPkg.root, 'package.json'));
        }
      }
    });

    // this has to be a separate pass over the packages because
    // linkNonCopiedDeps resolves dependencies, so we want all the packages
    // already in their new places before they start trying to resolve each
    // other.
    [...this.packageCache.moved.values()].forEach((newPkg, index) => {
      if (
        !this.didBuild || // always copy on the first build
        (newPkg.mayRebuild && changedMap.get(movedAddons[index]))
      ) {
        // for engines, this isn't the mangled destination (we don't need
        // resolvable node_modules there), this is the empty shell of their real
        // location
        this.linkNonCopiedDeps(newPkg, newPkg.root);
      }
    });

    this.linkNonCopiedDeps(this.app, this.appDestDir);
    await this.packageCache.updatePreexistingResolvableSymlinks();

    if (changedMap && changedMap.get(synthVendor)) {
      copySync(synthVendor, join(this.appDestDir, 'node_modules', '@embroider', 'synthesized-vendor'), {
        dereference: true,
        overwrite: true,
      });
    }

    if (changedMap && changedMap.get(synthStyles)) {
      copySync(synthStyles, join(this.appDestDir, 'node_modules', '@embroider', 'synthesized-styles'), {
        dereference: true,
        overwrite: true,
      });
    }

    if (!this.didBuild) {
      this.handleNonResolvableDeps();
    }
    this.didBuild = true;
    this.deferReady.resolve();
  }

  private handleNonResolvableDeps() {
    // non-resolvable deps in addons
    for (let [oldPkg, newPkg] of this.packageCache.moved.entries()) {
      if (!oldPkg.nonResolvableDeps) {
        continue;
      }
      for (let dep of oldPkg.nonResolvableDeps.values()) {
        let moved = this.packageCache.moved.get(dep);
        if (moved) {
          dep = moved;
        }
        let target = join(newPkg.root, 'node_modules', dep.name);
        ensureDirSync(dirname(target));
        ensureSymlinkSync(dep.root, target, 'dir');
      }
    }
    // non-resolvable deps in app
    if (this.packageCache.app.nonResolvableDeps) {
      for (let dep of this.packageCache.app.nonResolvableDeps.values()) {
        let moved = this.packageCache.moved.get(dep);
        if (moved) {
          dep = moved;
        }
        let target = join(this.appDestDir, 'node_modules', dep.name);
        ensureDirSync(dirname(target));
        ensureSymlinkSync(dep.root, target, 'dir');
      }
    }
  }

  private getSyntheticPackages(v1App: V1App, movedAddons: Node[]): { synthVendor: Node; synthStyles: Node } {
    let index = 0;
    let upgradedAddonTrees = [];
    for (let [oldPkg] of this.packageCache.moved.entries()) {
      if (!oldPkg.isV2Ember()) {
        upgradedAddonTrees.push(movedAddons[index]);
      }
      index++;
    }
    return {
      synthVendor: v1App.synthesizeVendorPackage(upgradedAddonTrees),
      synthStyles: v1App.synthesizeStylesPackage(upgradedAddonTrees),
    };
  }

  @Memoize()
  private get deferReady() {
    let resolve: Function;
    let promise: Promise<void> = new Promise(r => (resolve = r));
    return { resolve: resolve!, promise };
  }

  @Memoize()
  private isMoved(pkg: Package) {
    for (let candidate of this.packageCache.moved.values()) {
      if (candidate === pkg) {
        return true;
      }
    }
    return false;
  }

  private linkNonCopiedDeps(pkg: Package, destRoot: string) {
    for (let dep of pkg.dependencies) {
      if (!this.isMoved(dep)) {
        ensureSymlinkSync(dep.root, join(destRoot, 'node_modules', dep.packageJSON.name));
      }
    }
  }
}
