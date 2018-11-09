import { Memoize } from 'typescript-memoize';
import { readFileSync } from "fs";
import { join } from 'path';
import get from 'lodash/get';
import { AddonPackageJSON } from './metadata';
import { Tree } from 'broccoli-plugin';

export default abstract class Package {
  abstract readonly root: string;
  abstract readonly dependencies: Package[];

  get name() {
    return this.packageJSON.name;
  }

  @Memoize()
  get packageJSON() {
    return JSON.parse(readFileSync(join(this.root, 'package.json'), 'utf8'));
  }

  get isEmberPackage() : boolean {
    let keywords = this.packageJSON.keywords;
    return keywords && (keywords as string[]).includes('ember-addon');
  }

  get isNativeV2(): boolean {
    let version = get(this.packageJSON, 'ember-addon.version');
    return version === 2;
  }

  findDescendants(filter?: (pkg: Package) => boolean): Package[] {
    let pkgs = new Set();
    let queue : Package[] = [this];
    while (queue.length > 0) {
      let pkg = queue.shift();
      if (!pkgs.has(pkg)) {
        pkgs.add(pkg);
        pkg.dependencies.filter(filter).forEach(d => queue.push(d));
      }
    }
    pkgs.delete(this);
    return [...pkgs.values()];
  }
}

// Represents not just any NPM pakage, but an Ember v2-formatted addon package.
export abstract class EmberPackage extends Package {
  get isEmberPackage() {
    return true;
  }
  get packageJSON(): AddonPackageJSON {
    return super.packageJSON;
  }

  // this is all the code that needs to get mashed into the consuming
  // application's own package.
  abstract legacyAppTree: Tree;
}
