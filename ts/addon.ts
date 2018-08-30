import { join } from 'path';
import { Tree } from 'broccoli-plugin';
import mergeTrees from 'broccoli-merge-trees';
import V1InstanceCache from './v1-instance-cache';
import PackageCache from './package-cache';
import { todo } from './messages';
import ChooseTree from './choose-tree';
import Package from './package';
import V1Addon from './v1-addon';
import get from 'lodash/get';
import { existsSync } from 'fs';

export default class Addon extends Package {
  private oldPackage: V1Addon;

  constructor(public root: string, protected packageCache: PackageCache, private v1Cache: V1InstanceCache) {
    super(root);
  }

  get name(): string {
    return this.oldPackage.name;
  }

  // this is where we inform the package that it's being consumed by another,
  // meaning it should take confirmation from that other into account.
  addParent(pkg: Package){
    let v1Addon = this.v1Cache.getAddon(this.root, pkg.root);
    if (v1Addon) {
      if (!this.oldPackage) {
        this.oldPackage = v1Addon;
      } else if (v1Addon.hasAnyTrees()){
        todo(`duplicate build of ${v1Addon.name}`);
      }
    }
  }

  get vanillaTree(): Tree {
    let trees = this.oldPackage.v2Trees;
    return mergeTrees(trees);
  }

  protected dependencyKeys = ['dependencies'];

  get legacyAppTree(): Tree {
    return new ChooseTree(this.vanillaTree, {
      annotation: `vanilla-choose-app-tree.${this.name}`,
      srcDir: (inputPath) => {
        let path = join(inputPath, 'package.json');
        if (existsSync(path)) {
          let pkg = require(path);
          return get(pkg, 'ember-addon.app-js');
        } else {
          console.log(`${this.name} has no package.json?`);
        }
      }
    });
  }

  get isEmberPackage() : boolean {
    let keywords = this.packageJSON.keywords;
    return keywords && keywords.indexOf('ember-addon') !== -1;
  }
}
