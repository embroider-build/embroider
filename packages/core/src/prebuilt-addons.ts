import Stage from './stage';
import { realpathSync } from 'fs-extra';
import Package from './package';
import PackageCache from './package-cache';
import { UnwatchedDir } from 'broccoli-source';
import { Tree } from 'broccoli-plugin';

export default class PrebuiltAddons implements Stage {
  private packageCache: PackageCache;
  private appDestDir: string;
  readonly inputPath: string;
  readonly tree: Tree;

  constructor(appSrcDir: string, appDestDir: string) {
    this.inputPath = realpathSync(appSrcDir);
    this.appDestDir = realpathSync(appDestDir);
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
  constructor(private appSrcDir: string, private appDestDir: string) {
    super();
  }
  protected basedir(pkg: Package): string {
    if (pkg.root === this.appSrcDir) {
      return this.appDestDir;
    }
    return super.basedir(pkg);
  }
}
