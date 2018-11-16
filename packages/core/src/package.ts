import { Memoize } from 'typescript-memoize';
import { readFileSync } from "fs";
import { join } from 'path';
import get from 'lodash/get';
import { AddonMeta } from './metadata';

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

  get meta(): AddonMeta {
    if (!this.isV2) {
      throw new Error("Not a v2-formatted Ember package");
    }
    return this.packageJSON["ember-addon"] as AddonMeta;
  }

  get isEmberPackage() : boolean {
    let keywords = this.packageJSON.keywords;
    return keywords && (keywords as string[]).includes('ember-addon');
  }

  get isV2(): boolean {
    let version = get(this.packageJSON, 'ember-addon.version');
    return version === 2;
  }

  findDescendants(filter?: (pkg: Package) => boolean): Package[] {
    let pkgs = new Set();
    let queue : Package[] = [this];
    while (true) {
      let pkg = queue.shift();
      if (!pkg) { break; }
      if (!pkgs.has(pkg)) {
        pkgs.add(pkg);
        let nextLevel;
        if (filter) {
          nextLevel = pkg.dependencies.filter(filter);
        } else {
          nextLevel = pkg.dependencies;
        }
        nextLevel.forEach(d => queue.push(d));
      }
    }
    pkgs.delete(this);
    return [...pkgs.values()];
  }
}
