import Funnel from 'broccoli-funnel';
import V1InstanceCache from './v1-instance-cache';
import { Tree } from 'broccoli-plugin';
import PackageCache from './package-cache';
import Package from './package';
import AppEntrypoint from './app-entrypoint';
import mergeTrees from 'broccoli-merge-trees';

export default class AppPackage extends Package {
  constructor(public root: string, v1Cache: V1InstanceCache ) {
    super(root, new PackageCache(v1Cache), v1Cache);
    this.oldPackage = v1Cache.app;
  }

  get tree(): Tree {
    let own = super.tree;
    let entry = new AppEntrypoint(this.oldPackage.appTree, { package: this, outputPath: `assets/${this.name}.js` });
    return mergeTrees([own, entry]);
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
