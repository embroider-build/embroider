import Stage from "./stage";
import { realpathSync } from 'fs-extra';
import Package from "./package";
import PackageCache from "./package-cache";
import { UnwatchedDir } from "broccoli-source";

export default class PrebuiltWorkspace extends UnwatchedDir implements Stage {
  private packageCache: PackageCache;
  private appDestDir: string;
  readonly inputPath: string;

  constructor(appSrcDir: string, appDestDir: string) {
    appSrcDir = realpathSync(appSrcDir);
    appDestDir = realpathSync(appDestDir);
    super(appSrcDir);
    this.packageCache = new RehomedPackageCache(appSrcDir, appDestDir);
    this.inputPath = appSrcDir;
    this.appDestDir = appDestDir;
  }

  async ready(): Promise<{ packageCache: PackageCache, outputPath: string }> {
    return {
      packageCache: this.packageCache,
      outputPath: this.appDestDir
    };
  }

  get tree(){ return this; }
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
