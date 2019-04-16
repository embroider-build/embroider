import { Memoize } from 'typescript-memoize';
import { readFileSync } from 'fs';
import { join } from 'path';
import get from 'lodash/get';
import { AddonMeta } from './metadata';
import PackageCache from './package-cache';
import flatMap from 'lodash/flatMap';

export default class Package {
  private dependencyKeys: ('dependencies' | 'devDependencies' | 'peerDependencies')[];

  constructor(readonly root: string, mayUseDevDeps: boolean, protected packageCache: PackageCache) {
    this.dependencyKeys = mayUseDevDeps
      ? ['dependencies', 'devDependencies', 'peerDependencies']
      : ['dependencies', 'peerDependencies'];
  }

  get name(): string {
    return this.packageJSON.name;
  }

  get version(): string {
    return this.packageJSON.version;
  }

  @Memoize()
  get packageJSON() {
    return JSON.parse(readFileSync(join(this.root, 'package.json'), 'utf8'));
  }

  get meta(): AddonMeta {
    if (!this.isV2) {
      throw new Error('Not a v2-formatted Ember package');
    }
    return this.packageJSON['ember-addon'] as AddonMeta;
  }

  get isEmberPackage(): boolean {
    let keywords = this.packageJSON.keywords;
    return Boolean(keywords && (keywords as string[]).includes('ember-addon'));
  }

  get isV2(): boolean {
    let version = get(this.packageJSON, 'ember-addon.version');
    return version === 2;
  }

  findDescendants(filter?: (pkg: Package) => boolean): Package[] {
    let pkgs = new Set();
    let queue: Package[] = [this];
    while (true) {
      let pkg = queue.shift();
      if (!pkg) {
        break;
      }
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

  // by default, addons do not get rebuilt on the fly. This can be changed when
  // you are actively developing one.
  get mayRebuild(): boolean {
    return false;
  }

  @Memoize()
  get dependencies(): Package[] {
    let names = flatMap(this.dependencyKeys, key => Object.keys(this.packageJSON[key] || {}));
    return names.map(name => this.packageCache.resolve(name, this));
  }

  hasDependency(name: string): boolean {
    for (let section of this.dependencyKeys) {
      if (this.packageJSON[section]) {
        if (this.packageJSON[section][name]) {
          return true;
        }
      }
    }
    return false;
  }
}

export interface PackageConstructor {
  new (root: string, mayUseDevDeps: boolean, packageCache: PackageCache): Package;
}
