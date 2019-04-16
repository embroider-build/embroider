import { Tree } from 'broccoli-plugin';
import { join, relative, dirname } from 'path';
import { emptyDirSync, ensureSymlinkSync, ensureDirSync, realpathSync, copySync, writeJSONSync } from 'fs-extra';
import { Stage, Package, PackageCache, WaitForTrees } from '@embroider/core';
import V1InstanceCache from './v1-instance-cache';
import { tmpdir } from 'os';
import { MovedPackageCache } from './moved-package-cache';
import { Memoize } from 'typescript-memoize';
import buildCompatAddon from './build-compat-addon';
import Options, { optionsWithDefaults } from './options';
import V1App from './v1-app';
import { createHash } from 'crypto';

export default class CompatAddons implements Stage {
  private didBuild = false;
  private destDir: string;
  private packageCache: MovedPackageCache;
  private nonResolvableDeps: Package[];
  readonly inputPath: string;
  readonly tree: Tree;

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
    let movedAddons = [...this.packageCache.moved.keys()].map(oldPkg => buildCompatAddon(oldPkg, v1Cache));
    let { synthVendor, synthStyles } = this.getSyntheticPackages(v1Cache.app, movedAddons);
    this.nonResolvableDeps = v1Cache.app.nonResolvableDependencies();
    this.tree = new WaitForTrees(
      { movedAddons, synthVendor, synthStyles },
      '@embroider/compat/addons',
      this.build.bind(this)
    );
    this.inputPath = v1Cache.app.root;
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

  private async build({
    movedAddons,
    synthVendor,
    synthStyles,
  }: {
    movedAddons: string[];
    synthVendor: string;
    synthStyles: string;
  }) {
    if (this.didBuild) {
      // TODO: we can selectively allow some addons to rebuild, equivalent to
      // the old isDevelopingAddon. This should be based off Package#mayRebuild.
      return;
    }

    emptyDirSync(this.destDir);

    [...this.packageCache.moved.values()].forEach((movedPkg, index) => {
      copySync(movedAddons[index], movedPkg.root, { dereference: true });
      this.linkNonCopiedDeps(movedPkg, movedPkg.root);
    });
    this.linkNonCopiedDeps(this.app, this.appDestDir);
    await this.packageCache.updatePreexistingResolvableSymlinks();
    copySync(synthVendor, join(this.appDestDir, 'node_modules', '@embroider', 'synthesized-vendor'), {
      dereference: true,
    });
    copySync(synthStyles, join(this.appDestDir, 'node_modules', '@embroider', 'synthesized-styles'), {
      dereference: true,
    });
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
