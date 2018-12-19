import { Tree } from "broccoli-plugin";
import { join } from 'path';
import {
  emptyDirSync,
  ensureSymlinkSync,
  ensureDirSync,
  realpathSync,
  mkdtempSync,
  copySync,
  writeJSONSync,
  pathExistsSync,
} from 'fs-extra';
import { Stage, Package, PackageCache, WaitForTrees, AddonMeta } from '@embroider/core';
import V1InstanceCache from "./v1-instance-cache";
import { tmpdir } from 'os';
import { MovedPackageCache } from "./moved-package-cache";
import { Memoize } from "typescript-memoize";
import buildCompatAddon from './build-compat-addon';
import AddonOptions, { defaultOptions, AddonOptionsWithDefaults } from './options';
import V1App from "./v1-app";

export default class CompatAddons implements Stage {
  private didBuild = false;
  private destDir: string;
  private packageCache: MovedPackageCache;
  private v1App: V1App;
  readonly inputPath: string;
  readonly tree: Tree;

  constructor(legacyEmberAppInstance: object, maybeOptions?: AddonOptions) {
    let options = Object.assign({}, defaultOptions(), maybeOptions) as AddonOptionsWithDefaults;
    if (options && options.workspaceDir) {
      ensureDirSync(options.workspaceDir);
      this.destDir = realpathSync(options.workspaceDir);
    } else {
      this.destDir = mkdtempSync(join(tmpdir(), 'embroider-'));
    }
    let v1Cache = V1InstanceCache.forApp(legacyEmberAppInstance, options);
    this.packageCache = v1Cache.packageCache.moveAddons(v1Cache.app.root, this.destDir);
    let movedAddons = [...this.packageCache.moved.keys()].map(oldPkg => buildCompatAddon(oldPkg, v1Cache));
    this.tree = new WaitForTrees({ movedAddons }, '@embroider/compat/addons', this.build.bind(this));
    this.inputPath = v1Cache.app.root;
    this.v1App = v1Cache.app;
  }

  async ready(): Promise<{ outputPath: string, packageCache: PackageCache }>{
    await this.deferReady.promise;
    return {
      outputPath: this.packageCache.appDestDir,
      packageCache: this.packageCache
    };
  }

  private get appDestDir(): string {
    return this.packageCache.appDestDir;
  }

  private get app(): Package {
    return this.packageCache.app;
  }

  private async build({ movedAddons }: { movedAddons: string[] }) {
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
    this.synthesizeVendorPackage();
    this.didBuild = true;
    this.deferReady.resolve();
  }

  private synthesizeVendorPackage() {
    let target = join(this.appDestDir, 'node_modules', '@embroider', 'synthesized-vendor');
    ensureDirSync(target);
    for (let [ oldPkg, newPkg ] of this.packageCache.moved.entries()) {
      if (!oldPkg.isV2 && newPkg.isV2) {
        let vendorDir = join(newPkg.root, 'vendor');
        if (pathExistsSync(vendorDir)) {
          copySync(vendorDir, target);
        }
      }
    }
    let addonMeta: AddonMeta = {
      version: 2,
      "implicit-scripts": this.v1App.implicitAssets('implicit-scripts'),
      "implicit-styles": this.v1App.implicitAssets('implicit-styles'),
      "implicit-test-scripts": this.v1App.implicitAssets('implicit-test-scripts'),
      "implicit-test-styles": this.v1App.implicitAssets('implicit-test-styles'),
    };
    let meta = {
      name: '@embroider/synthesized-vendor',
      version: '0.0.0',
      keywords: 'ember-addon',
      'ember-addon': addonMeta
    };
    writeJSONSync(join(target, 'package.json'), meta, { spaces: 2 });
  }

  @Memoize()
  private get deferReady() {
    let resolve: Function;
    let promise: Promise<void> = new Promise(r => resolve =r);
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
