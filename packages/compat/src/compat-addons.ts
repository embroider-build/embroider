import { Tree } from 'broccoli-plugin';
import { join, relative, dirname } from 'path';
import { emptyDirSync, ensureSymlinkSync, ensureDirSync, realpathSync, copySync, writeJSONSync } from 'fs-extra';
import { Stage, Package, PackageCache, WaitForTrees, mangledEngineRoot } from '@embroider/core';
import V1InstanceCache from './v1-instance-cache';
import { tmpdir } from 'os';
import { MovedPackageCache } from './moved-package-cache';
import { Memoize } from 'typescript-memoize';
import buildCompatAddon from './build-compat-addon';
import Options, { optionsWithDefaults } from './options';
import V1App from './v1-app';
import { createHash } from 'crypto';
import TreeSync from 'tree-sync';

export default class CompatAddons implements Stage {
  private didBuild = false;
  private destDir: string;
  private packageCache: MovedPackageCache;
  private nonResolvableDeps: Package[];
  private treeSyncMap: WeakMap<Package, TreeSync>;
  private v1Cache: V1InstanceCache;
  readonly inputPath: string;

  constructor(legacyEmberAppInstance: object, maybeOptions?: Options) {
    let options = optionsWithDefaults(maybeOptions);
    let v1Cache = V1InstanceCache.forApp(legacyEmberAppInstance, options);
    if (options && options.workspaceDir) {
      ensureDirSync(options.workspaceDir);
      this.destDir = realpathSync(options.workspaceDir);
    } else {
      // we want this to be stable across builds, because it becomes part of the
      // path to all of the files that the stage3 packager sees, and we want to
      // benefit from on-disk caching in stage3 packagers.
      let dir = this.stableWorkspaceDir(v1Cache.app);
      ensureDirSync(dir);
      this.destDir = realpathSync(dir);
    }
    this.packageCache = v1Cache.packageCache.moveAddons(v1Cache.app.root, this.destDir);
    this.nonResolvableDeps = v1Cache.app.nonResolvableDependencies();
    this.inputPath = v1Cache.app.root;
    this.treeSyncMap = new WeakMap();
    this.v1Cache = v1Cache;
  }

  get tree(): Tree {
    let movedAddons = [...this.packageCache.moved.keys()].map(oldPkg => buildCompatAddon(oldPkg, this.v1Cache));
    let { synthVendor, synthStyles } = this.getSyntheticPackages(this.v1Cache.app, movedAddons);
    return new WaitForTrees(
      { movedAddons, synthVendor, synthStyles },
      '@embroider/compat/addons',
      this.build.bind(this)
    );
  }

  async ready(): Promise<{ outputPath: string; packageCache: PackageCache }> {
    await this.deferReady.promise;
    writeJSONSync(join(this.destDir, '.embroider-reuse.json'), {
      appDestDir: relative(this.destDir, this.packageCache.appDestDir),
    });
    return {
      outputPath: this.packageCache.appDestDir,
      packageCache: this.packageCache,
    };
  }

  private get appDestDir(): string {
    return this.packageCache.appDestDir;
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
    changedMap?: Map<string, boolean>
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
        treeInstance = new TreeSync(movedAddons[index], destination, {
          ignore: ['**/node_modules'],
        });

        this.treeSyncMap.set(newPkg, treeInstance);
      }

      if (
        !this.didBuild || // always copy on the first build
        (changedMap && changedMap.get(movedAddons[index])) || // broccoli has told us that this node has been changed
        newPkg.mayRebuild // prevent rebuilds if not allowed
      ) {
        treeInstance.sync();
        if (!this.didBuild && isEngine) {
          // The first time we encounter an engine, we also create the empty
          // shell for its real module namespace.
          copySync(join(destination, 'package.json'), join(newPkg.root, 'package.json'));
        }
        this.linkNonCopiedDeps(newPkg, destination);
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

    this.handleNonResolvableDeps();
    this.didBuild = true;
    this.deferReady.resolve();
  }

  private handleNonResolvableDeps() {
    for (let dep of this.nonResolvableDeps) {
      let moved = this.packageCache.moved.get(dep);
      if (moved) {
        dep = moved;
      }
      let target = join(this.appDestDir, 'node_modules', dep.name);
      ensureDirSync(dirname(target));
      ensureSymlinkSync(dep.root, target, 'dir');
    }
  }

  private getSyntheticPackages(v1App: V1App, movedAddons: Tree[]): { synthVendor: Tree; synthStyles: Tree } {
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

  private stableWorkspaceDir(app: V1App) {
    let hash = createHash('md5');
    hash.update(app.root);
    return join(tmpdir(), 'embroider', hash.digest('hex').slice(0, 6));
  }
}
