import { Stage, Package, PackageCache } from '@embroider/core';
import { realpathSync, readJSONSync } from 'fs-extra';
import { UnwatchedDir } from 'broccoli-source';
import { Node } from 'broccoli-node-api';
import { join } from 'path';
import Options, { optionsWithDefaults } from './options';
import V1InstanceCache from './v1-instance-cache';

export default class PrebuiltAddons implements Stage {
  private packageCache: PackageCache;
  private appDestDir: string;
  readonly inputPath: string;
  readonly tree: Node;

  constructor(legacyEmberAppInstance: object, maybeOptions: Options | undefined, workspaceDir: string) {
    let options = optionsWithDefaults(maybeOptions);
    let v1Cache = V1InstanceCache.forApp(legacyEmberAppInstance, options);
    this.inputPath = realpathSync(v1Cache.app.root);
    let { appDestDir } = readJSONSync(join(workspaceDir, '.embroider-reuse.json'));
    this.appDestDir = realpathSync(join(workspaceDir, appDestDir));
    this.packageCache = new RehomedPackageCache(this.inputPath, this.appDestDir);
    this.tree = new UnwatchedDir(this.inputPath);
  }

  async ready(): Promise<{ packageCache: PackageCache; outputPath: string }> {
    return {
      packageCache: this.packageCache,
      outputPath: this.appDestDir,
    };
  }
}

class RehomedPackageCache extends PackageCache {
  constructor(private appSrcDir: string, appDestDir: string) {
    super(appDestDir);
  }
  basedir(pkg: Package): string {
    if (pkg.root === this.appSrcDir) {
      return this.appRoot;
    }
    return super.basedir(pkg);
  }
}
