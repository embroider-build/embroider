import { Memoize } from 'typescript-memoize';
import { readFileSync, existsSync } from 'fs-extra';
import { join, extname } from 'path';
import get from 'lodash/get';
import { AddonMeta, AppMeta, PackageInfo } from './metadata';
import PackageCache from './package-cache';
import flatMap from 'lodash/flatMap';
export default class Package {
  private dependencyKeys: ('dependencies' | 'devDependencies' | 'peerDependencies')[];

  constructor(readonly root: string, protected packageCache: PackageCache, isApp: boolean) {
    this.dependencyKeys = isApp
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
  protected get internalPackageJSON() {
    return JSON.parse(readFileSync(join(this.root, 'package.json'), 'utf8'));
  }

  @Memoize()
  get packageJSON(): PackageInfo {
    let json = this.internalPackageJSON;
    if (this.nonResolvableDeps) {
      if (!json.dependencies) {
        json.dependencies = {};
      }
      for (let dep of this.nonResolvableDeps.values()) {
        json.dependencies[dep.name] = dep.version || '*';
      }
    }
    return json;
  }

  get meta(): AddonMeta | AppMeta | undefined {
    let m = this.packageJSON['ember-addon'];
    if (this.isV2App()) {
      return m as unknown as AppMeta;
    }
    if (this.isV2Addon()) {
      return m as AddonMeta;
    }
  }

  isEmberPackage(): boolean {
    let keywords = this.packageJSON.keywords;
    return Boolean(keywords && (keywords as string[]).includes('ember-addon'));
  }

  isEngine(): boolean {
    let keywords = this.packageJSON.keywords;
    return Boolean(keywords && (keywords as string[]).includes('ember-engine'));
  }

  isLazyEngine(): boolean {
    return this.isEngine() && Boolean(get(this.packageJSON, 'ember-addon.lazy-engine'));
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
    let pkgs = new Set<Package>();
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

  get mayRebuild(): boolean {
    // if broccoli memoization is enabled, allowing addons to rebuild
    // automatically is cheap, so we allow all addons to rebuild.
    if (process.env['BROCCOLI_ENABLED_MEMOIZE'] === 'true') {
      return true;
    }

    // Otherwise, we only allow addons to rebuild that you've explicitly asked for
    // via env var.
    if (process.env.EMBROIDER_REBUILD_ADDONS) {
      if (process.env.EMBROIDER_REBUILD_ADDONS.split(',').includes(this.name)) {
        return true;
      }
    }
    return false;
  }

  @Memoize()
  get nonResolvableDeps(): Map<string, Package> | undefined {
    let meta = this.internalPackageJSON['ember-addon'];
    if (meta && meta.paths) {
      return new Map(
        meta.paths
          .map((path: string) => {
            // ember-cli gives a warning if the path specifies an invalid, malformed or missing addon. the logic for invalidating an addon is:
            // https://github.com/ember-cli/ember-cli/blob/627934f91b2aa0e19b041fdb1b547873c1855793/lib/models/package-info-cache/index.js#L427
            //
            // Note that we only need to be this lenient with in-repo addons,
            // which is why this logic is here in nonResolvableDeps. If you try
            // to ship broken stuff in regular dependencies, NPM is going to
            // stop you.
            let pkg, main;
            try {
              pkg = this.packageCache.get(join(this.packageCache.basedir(this), path));
              main = pkg.packageJSON['ember-addon']?.main || pkg.packageJSON['main'];
            } catch (err) {
              // package was missing or had invalid package.json
              return false;
            }

            if (!main || main === '.' || main === './') {
              main = 'index.js';
            } else if (!extname(main)) {
              main = `${main}.js`;
            }

            let mainPath = join(this.packageCache.basedir(this), path, main);
            if (!existsSync(mainPath)) {
              // package has no valid main
              return false;
            }
            return [pkg.name, pkg];
          })
          .filter(Boolean)
      );
    }
  }

  get dependencyNames(): string[] {
    return flatMap(this.dependencyKeys, key => Object.keys(this.packageJSON[key] || {}));
  }

  @Memoize()
  get dependencies(): Package[] {
    return this.dependencyNames
      .map(name => {
        if (this.nonResolvableDeps) {
          let dep = this.nonResolvableDeps.get(name);
          if (dep) {
            return dep;
          }
        }
        try {
          return this.packageCache.resolve(name, this);
        } catch (error) {
          // if the package was not found do not error out here. this is relevant
          // for the case where a package might be an optional peerDependency and we dont
          // want to error if it was not found. Additionally, erroring here is "far" away
          // from the actual logical failure point and so not failing here will provide a better
          // error message down the line
          if (error.code === 'MODULE_NOT_FOUND') {
            return false;
          }

          throw error;
        }
      })
      .filter(Boolean) as Package[];
  }

  hasDependency(name: string): boolean {
    for (let section of this.dependencyKeys) {
      if (this.packageJSON[section]) {
        if ((this.packageJSON[section] as Record<string, string>)[name]) {
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
