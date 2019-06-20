import { Memoize } from 'typescript-memoize';
import { readFileSync } from 'fs';
import { join } from 'path';
import get from 'lodash/get';
import { AddonMeta, AppMeta } from './metadata';
import PackageCache from './package-cache';
import flatMap from 'lodash/flatMap';

export default class Package {
  private dependencyKeys: ('dependencies' | 'devDependencies' | 'peerDependencies')[];

  constructor(readonly root: string, protected packageCache: PackageCache, isApp?: boolean) {
    // In stage1 and stage2, we're careful to make sure our PackageCache entry
    // for the app itself gets created with an explicit `isApp` flag. In stage3
    // we don't have that much control, but we can rely on the v2-formatted app
    // being easy to identify from its metadata.
    let mayUseDevDeps = typeof isApp === 'boolean' ? isApp : this.isV2App();

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

  get meta(): AddonMeta | AppMeta | undefined {
    let m = this.packageJSON['ember-addon'];
    if (this.isV2App()) {
      return m as AppMeta;
    }
    if (this.isV2Addon()) {
      return m as AddonMeta;
    }
  }

  isEmberPackage(): boolean {
    let keywords = this.packageJSON.keywords;
    return Boolean(keywords && (keywords as string[]).includes('ember-addon'));
  }

  isV2Ember(): this is V2Package {
    return this.isEmberPackage() && get(this.packageJSON, 'ember-addon.version') === 2;
  }

  isV2App(): this is V2AppPackage {
    return this.isV2Ember() && this.packageJSON['ember-addon'].type === 'app';
  }

  isV2Addon(): this is V2AddonPackage {
    return this.isV2Ember() && this.packageJSON['ember-addon'].type === 'addon';
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
    let broccoli_memoization = process.env['BROCCOLI_ENABLED_MEMOIZE'];
    return broccoli_memoization === 'true';
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

export interface V2Package extends Package {
  meta: AddonMeta | AppMeta;
}

export interface V2AddonPackage extends Package {
  meta: AddonMeta;
}

export interface V2AppPackage extends Package {
  meta: AppMeta;
}
