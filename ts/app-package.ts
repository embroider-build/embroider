import Funnel from 'broccoli-funnel';
import mergeTrees from 'broccoli-merge-trees';
import AddonPackage from './addon-package';
import V1InstanceCache from './v1-instance-cache';
import V1App from './v1-app';
import { Tree } from 'broccoli-plugin';
import { join, dirname } from 'path';
import { Memoize } from 'typescript-memoize';
import resolve from 'resolve';
import PackageCache from './package-cache';
import Package from './package';

export default class AppPackage implements Package {
  private oldApp: V1App;
  private packageCache: PackageCache;

  constructor(public root: string, v1Cache: V1InstanceCache ) {
    this.oldApp = v1Cache.app;
    this.packageCache = new PackageCache(v1Cache);
  }

  get tree(): Tree {
    let trees = this.oldApp.v2Trees();
    return new Funnel(mergeTrees(trees), {
      destDir: this.oldApp.name
    });
  }

  @Memoize()
  private get packageJSON() {
    return require(join(this.root, 'package.json'));
  }

  get isEmberPackage() : boolean {
    let keywords = this.packageJSON.keywords;
    return keywords && keywords.indexOf('ember-addon') !== -1;
  }

  get dependencies(): AddonPackage[] {
    let names = Object.keys(Object.assign({}, this.packageJSON.dependencies, this.packageJSON.devDependencies));
    return names.map(name => {
      let addonRoot = dirname(resolve.sync(join(name, 'package.json'), { basedir: this.root }));
      return this.packageCache.getPackage(addonRoot, this);
    }).filter(Boolean);
  }

  // TODO: This is a placeholder for development purposes only.n
  dumpTrees() {
    let pkgs = new Set();
    let queue : Package[] = [this];
    while (queue.length > 0) {
      let pkg = queue.shift();
      if (!pkgs.has(pkg)) {
        pkgs.add(pkg);
        pkg.dependencies.forEach(d => queue.push(d));
      }
    }
    return [...pkgs.values()].map((pkg, index) => new Funnel(pkg.tree, { destDir: `out-${index}` }));
  }

}
