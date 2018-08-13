import Funnel from 'broccoli-funnel';
import mergeTrees from 'broccoli-merge-trees';
import AddonPackage from './addon-package';
import V1InstanceCache from './v1-instance-cache';
import flatten from 'lodash/flatten';
import V1App from './v1-app';
import { Tree } from 'broccoli-plugin';

export default class AppPackage {
  private oldApp: V1App;

  constructor(root: string, private v1Cache: V1InstanceCache ) {
    this.oldApp = v1Cache.getApp(root);
  }

  get tree(): Tree {
    let trees = this.oldApp.v2Trees();
    return new Funnel(mergeTrees(trees), {
      destDir: this.oldApp.name
    });
  }

  // TODO: This is a placeholder for development purposes only.
  dumpTrees() {
    let pkgs = flatten([...(this.v1Cache as any).addons.values()]).map(v1Addon => new AddonPackage((v1Addon as any).addon));
    (pkgs as any).unshift(this);
    return pkgs.map((pkg, index) => new Funnel(pkg.tree, { destDir: `out-${index}` }));
  }

}
