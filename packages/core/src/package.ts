import { Memoize } from 'typescript-memoize';
import { readFileSync } from 'fs';
import { join } from 'path';
import get from 'lodash/get';
//import DAGMap from 'dag-map';
import { AddonMeta, AppMeta } from './metadata';
import PackageCache from './package-cache';
import flatMap from 'lodash/flatMap';
import { lexicographically, pushUnique } from './dependency-ordering-utils';

export default class Package {
  private dependencyKeys: ('devDependencies' | 'dependencies' | 'peerDependencies')[];

  constructor(readonly root: string, protected packageCache: PackageCache, isApp?: boolean) {
    // In stage1 and stage2, we're careful to make sure our PackageCache entry
    // for the app itself gets created with an explicit `isApp` flag. In stage3
    // we don't have that much control, but we can rely on the v2-formatted app
    // being easy to identify from its metadata.
    let mayUseDevDeps = typeof isApp === 'boolean' ? isApp : this.isV2App();

    this.dependencyKeys = mayUseDevDeps
      ? ['devDependencies', 'dependencies', 'peerDependencies']
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

  // traditionally, ember-cli only rebuilds addons that set their own
  // isDevelopingAddon to true. This is a performance optimization. But as of
  // ember-cli 3.15, the performance problem is fixed behind the
  // BROCCOLI_ENABLED_MEMOIZE feature flag. We will rely on that feature here,
  // and just enable all rebuilds whenever the flag is set.
  get mayRebuild(): boolean {
    let broccoli_memoization = process.env['BROCCOLI_ENABLED_MEMOIZE'];
    return broccoli_memoization === 'true';
  }

  // ensures ordering within devDependencies or dependencies is always lexicographical sorted
  // (regardless of the order within package.json). If duplicates exist between devDependencies
  // and dependencies, we take a “element of least surprise approach”. They are de-duped, and
  // the “last occurrence” encountered solidifies the ordering.  order([a,b,c,a]) => [b,c,a]
  // We follow this pattern as it is what ember-cli does and we want to maintain that ordering
  // because it will effect "who wins" when it comes to merging the appTree.
  @Memoize()
  get dependencies(): Package[] {
    let sortedDependencies = flatMap(this.dependencyKeys, key => {
      let keys = Object.keys(this.packageJSON[key] || {});
      return keys.sort(lexicographically);
    });

    let unqiuelySortedDeps: string[] = [];
    sortedDependencies.forEach(dep => pushUnique(unqiuelySortedDeps, dep));

    // let graph = new DAGMap<Package>();
    // unqiuelySortedDeps.forEach(name => {
    //   let cache = this.packageCache.resolve(name, this);
    //   let emberAddonConfig = cache.meta;

    //   graph.add(name, cache, emberAddonConfig.before, emberAddonConfig.after);
    // });

    // let values: Package[] = [];
    // graph.each((_, val) => {
    //   if (val) {
    //     values.push(val);
    //   }
    // });
    // return values;

    return unqiuelySortedDeps.map(name => this.packageCache.resolve(name, this));
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
