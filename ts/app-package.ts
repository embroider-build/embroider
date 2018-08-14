import Funnel from 'broccoli-funnel';
import mergeTrees from 'broccoli-merge-trees';
import V1InstanceCache from './v1-instance-cache';
import V1App from './v1-app';
import { Tree } from 'broccoli-plugin';
import PackageCache from './package-cache';
import Package from './package';

export default class AppPackage extends Package {
  private oldApp: V1App;

  constructor(public root: string, v1Cache: V1InstanceCache ) {
    super(root, new PackageCache(v1Cache), v1Cache);
    this.oldApp = v1Cache.app;
  }

  get tree(): Tree {
    let trees = this.oldApp.v2Trees();
    return new Funnel(mergeTrees(trees), {
      destDir: this.oldApp.name
    });
  }

  protected dependencyKeys() {
    return ['dependencies', 'devDependencies'];
  }

  // TODO: This is a placeholder for development purposes only.
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
