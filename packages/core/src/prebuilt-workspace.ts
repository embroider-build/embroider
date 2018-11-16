import Workspace from "./workspace";
import { join } from 'path';
import {
  readdirSync,
  removeSync,
  copySync,
  realpathSync
} from 'fs-extra';
import Package from "./package";
import PackageCache from "./package-cache";
import { UnwatchedDir } from "broccoli-source";

export default class PrebuiltWorkspace extends UnwatchedDir implements Workspace {
  private packageCache: PackageCache;
  readonly appDestDir: string;
  private appSrcDir: string;

  constructor(appSrcDir: string, appDestDir: string) {
    appSrcDir = realpathSync(appSrcDir);
    appDestDir = realpathSync(appDestDir);
    super(appSrcDir);
    this.packageCache = new RehomedPackageCache(appSrcDir, appDestDir);
    this.appSrcDir = appSrcDir;
    this.appDestDir = appDestDir;
    this.clearApp();
  }

  get app(): Package {
    return this.packageCache.getApp(this.appSrcDir);
  }

  clearApp() {
    for (let name of readdirSync(this.appDestDir)) {
      if (name !== 'node_modules') {
        removeSync(join(this.appDestDir, name));
      }
    }
  }

  copyIntoApp(srcDir: string) {
    copySync(srcDir, this.appDestDir, { dereference: true });
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
