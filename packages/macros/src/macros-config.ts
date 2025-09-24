import fs from 'fs';
import { join } from 'path';
import crypto from 'crypto';
import findUp from 'find-up';
import type { PluginItem } from '@babel/core';
import { RewrittenPackageCache, getOrCreate } from '@embroider/shared-internals';
import type { FirstTransformParams } from './glimmer/ast-transform';
import { makeFirstTransform, makeSecondTransform } from './glimmer/ast-transform';
import type State from './babel/state';
import partition from 'lodash/partition';

export type SourceOfConfig = (config: object) => {
  readonly name: string;
  readonly root: string;
  readonly version: string;
};

export type Merger = (
  configs: object[],
  params: {
    sourceOfConfig: SourceOfConfig;
  }
) => object;

interface GlobalSharedEntry {
  configs: Map<string, object[]>;
  globalConfigs: Record<string, string>;
  configSources: WeakMap<object, string>;
  mergers: Map<string, { merger: Merger; fromPath: string }>;
}

// Do not change this type signature without pondering deeply the mysteries of
// being compatible with unwritten future versions of this library.
type GlobalSharedState = WeakMap<any, GlobalSharedEntry>;

// this is a module-scoped cache. If multiple callers ask _this copy_ of
// @embroider/macros for a shared MacrosConfig, they'll all get the same one.
// And if somebody asks a *different* copy of @embroider/macros for the shared
// MacrosConfig, it will have its own instance with its own code, but will still
// share the GlobalSharedState beneath.
let localSharedState: WeakMap<any, MacrosConfig> = new WeakMap();

function gatherAddonCacheKeyWorker(item: any, memo: Set<string>) {
  item.addons.forEach((addon: any) => {
    let key = `${addon.pkg.name}@${addon.pkg.version}`;
    memo.add(key);
    gatherAddonCacheKeyWorker(addon, memo);
  });
}

let addonCacheKey: WeakMap<any, string> = new WeakMap();
// creates a string representing all addons and their versions
// (foo@1.0.0|bar@2.0.0) to use as a cachekey
function gatherAddonCacheKey(project: any): string {
  let cacheKey = addonCacheKey.get(project);
  if (cacheKey) {
    return cacheKey;
  }

  let memo: Set<string> = new Set();
  project.addons.forEach((addon: any) => {
    let key = `${addon.pkg.name}@${addon.pkg.version}`;
    memo.add(key);
    gatherAddonCacheKeyWorker(addon, memo);
  });

  cacheKey = [...memo].join('|');
  addonCacheKey.set(project, cacheKey);

  return cacheKey;
}

const babelCacheBustingPluginPath: string = require.resolve(
  '@embroider/shared-internals/src/babel-plugin-cache-busting'
);

export default class MacrosConfig {
  static for(key: any, appRoot: string): MacrosConfig {
    let found = localSharedState.get(key);
    if (found) {
      return found;
    }

    let g = global as any as { __embroider_macros_global__: GlobalSharedState | undefined };
    if (!g.__embroider_macros_global__) {
      g.__embroider_macros_global__ = new WeakMap();
    }

    let shared = g.__embroider_macros_global__.get(key);
    if (shared) {
      // if an earlier version of @embroider/macros created the shared state, it
      // would have configSources.
      if (!shared.configSources) {
        shared.configSources = new WeakMap();
      }

      // earlier versions did not include this -- we may need to upgrade the
      // format here
      if (!shared.globalConfigs) {
        shared.globalConfigs = {};
      }
    } else {
      shared = {
        configs: new Map(),
        globalConfigs: {},
        configSources: new WeakMap(),
        mergers: new Map(),
      };
      g.__embroider_macros_global__.set(key, shared);
    }

    let config = new MacrosConfig(appRoot, shared);
    localSharedState.set(key, config);
    return config;
  }

  private mode: 'compile-time' | 'run-time' = 'compile-time';
  private globalConfig: { [key: string]: unknown };

  private isDevelopingPackageRoots: Set<string> = new Set();

  enableRuntimeMode() {
    if (this.mode !== 'run-time') {
      if (!this._configWritable) {
        throw new Error(`[Embroider:MacrosConfig] attempted to enableRuntimeMode after configs have been finalized`);
      }
      this.mode = 'run-time';
    }
  }

  enablePackageDevelopment(packageRoot: string) {
    if (!this.isDevelopingPackageRoots.has(packageRoot)) {
      if (!this._configWritable) {
        throw new Error(
          `[Embroider:MacrosConfig] attempted to enablePackageDevelopment after configs have been finalized`
        );
      }
      this.isDevelopingPackageRoots.add(packageRoot);
    }
  }

  private _importSyncImplementation: 'cjs' | 'eager' = 'cjs';

  get importSyncImplementation() {
    return this._importSyncImplementation;
  }

  set importSyncImplementation(value: 'cjs' | 'eager') {
    if (!this._configWritable) {
      throw new Error(
        `[Embroider:MacrosConfig] attempted to set importSyncImplementation after configs have been finalized`
      );
    }
    this._importSyncImplementation = value;
  }

  private constructor(private origAppRoot: string, shared: GlobalSharedEntry) {
    this.configs = shared.configs;
    this.globalConfig = shared.globalConfigs;
    this.configSources = shared.configSources;
    this.mergers = shared.mergers;

    // this uses globalConfig because these things truly are global. Even if a
    // package doesn't have a dep or peerDep on @embroider/macros, it's legit
    // for them to want to know the answer to these questions, and there is only
    // one answer throughout the whole dependency graph.
    this.globalConfig['@embroider/macros'] = {
      // this powers the `isTesting` macro. It always starts out false here,
      // because:
      //  - if this is a production build, we will evaluate all macros at build
      //    time and isTesting will stay false, so test-only code will not be
      //    included.
      //  - if this is a dev build, we evaluate macros at runtime, which allows
      //    both "I'm running my app in development" and "I'm running my test
      //    suite" to coexist within a single build. When you run the test
      //    suite, early in the runtime boot process we can flip isTesting to
      //    true to distinguish the two.
      isTesting: false,
    };
  }

  private get packageCache() {
    return RewrittenPackageCache.shared('embroider', this.origAppRoot);
  }

  private get appRoot(): string {
    return this.origAppRoot;
  }

  private _configWritable = true;
  private configs: Map<string, object[]>;
  private configSources: WeakMap<object, string>;
  private mergers: Map<string, { merger: Merger; fromPath: string }>;

  // Registers a new source of configuration to be given to the named package.
  // Your config type must be json-serializable. You must always set fromPath to
  // `__filename`.
  setConfig(fromPath: string, packageName: string, config: object) {
    return this.internalSetConfig(fromPath, packageName, config);
  }

  // Registers a new source of configuration to be given to your own package.
  // Your config type must be json-serializable. You must always set fromPath to
  // `__filename`.
  setOwnConfig(fromPath: string, config: object) {
    return this.internalSetConfig(fromPath, undefined, config);
  }

  // Registers a new source of configuration to be shared globally within the
  // app. USE GLOBALS SPARINGLY! Prefer setConfig or setOwnConfig instead,
  // unless your state is truly, necessarily global.
  //
  // Include a relevant package name in your key to help avoid collisions.
  //
  // Your value must be json-serializable. You must always set fromPath to
  // `__filename`.
  setGlobalConfig(fromPath: string, key: string, value: object) {
    if (!this._configWritable) {
      throw new Error(
        `[Embroider:MacrosConfig] attempted to set global config after configs have been finalized from: '${fromPath}'`
      );
    }
    this.globalConfig[key] = value;
  }

  private internalSetConfig(fromPath: string, packageName: string | undefined, config: object) {
    if (!this._configWritable) {
      throw new Error(
        `[Embroider:MacrosConfig] attempted to set config after configs have been finalized from: '${fromPath}'`
      );
    }

    if (!isSerializable(config)) {
      throw new Error(
        `[Embroider:MacrosConfig] the given config from '${fromPath}' for packageName '${packageName}' is not JSON serializable.`
      );
    }

    let targetPackage = this.resolvePackage(fromPath, packageName);
    let peers = getOrCreate(this.configs, targetPackage.root, () => []);
    peers.push(config);
    this.configSources.set(config, fromPath);
  }

  // Allows you to set the merging strategy used for your package's config. The
  // merging strategy applies when multiple other packages all try to send
  // configuration to you.
  useMerger(fromPath: string, merger: Merger) {
    if (this._configWritable) {
      throw new Error(`[Embroider:MacrosConfig] attempted to call useMerger after configs have been finalized`);
    }

    let targetPackage = this.resolvePackage(fromPath, undefined);
    let other = this.mergers.get(targetPackage.root);
    if (other) {
      throw new Error(
        `[Embroider:MacrosConfig] conflicting mergers registered for package ${targetPackage.name} at ${targetPackage.root}. See ${other.fromPath} and ${fromPath}.`
      );
    }
    this.mergers.set(targetPackage.root, { merger, fromPath });
  }

  private cachedUserConfigs: { [packageRoot: string]: object } | undefined;

  private get userConfigs() {
    if (this._configWritable) {
      throw new Error('[Embroider:MacrosConfig] cannot read userConfigs until MacrosConfig has been finalized.');
    }

    if (!this.cachedUserConfigs) {
      let userConfigs: { [packageRoot: string]: object } = {};
      let sourceOfConfig = this.makeConfigSourcer(this.configSources);
      for (let [pkgRoot, configs] of this.configs) {
        let combined: object;
        if (configs.length > 1) {
          combined = this.mergerFor(pkgRoot)(configs, { sourceOfConfig });
        } else {
          combined = configs[0];
        }
        userConfigs[pkgRoot] = combined;
      }
      this.cachedUserConfigs = userConfigs;
    }

    return this.cachedUserConfigs;
  }

  private makeConfigSourcer(configSources: WeakMap<object, string>): SourceOfConfig {
    return config => {
      let fromPath = configSources.get(config);
      if (!fromPath) {
        throw new Error(
          `unknown object passed to sourceOfConfig(). You can only pass back the configs you were given.`
        );
      }
      let maybePkg = this.packageCache.ownerOfFile(fromPath);
      if (!maybePkg) {
        throw new Error(
          `bug: unexpected error, we always check that fromPath is owned during internalSetConfig so this should never happen`
        );
      }
      // our configs all deal in the original locations of packages, even if
      // embroider is rewriting some of them
      let pkg = this.packageCache.original(maybePkg);
      return {
        get name() {
          return pkg.name;
        },
        get version() {
          return pkg.version;
        },
        get root() {
          return pkg.root;
        },
      };
    };
  }

  private static lockFilePathForAppRoot: Map<string, string | undefined> = new Map();
  private static getLockFilePath(appRoot: string): string | undefined {
    if (this.lockFilePathForAppRoot.has(appRoot)) {
      return this.lockFilePathForAppRoot.get(appRoot);
    }
    let path = findUp.sync(['yarn.lock', 'package-lock.json', 'pnpm-lock.yaml'], { cwd: appRoot });
    this.lockFilePathForAppRoot.set(appRoot, path);
    return path;
  }

  private static packageJsonPathForAppPackageRoot: Map<string, string | undefined> = new Map();
  private static getPackageJsonPath(appPackageRoot: string): string | undefined {
    if (this.packageJsonPathForAppPackageRoot.has(appPackageRoot)) {
      return this.packageJsonPathForAppPackageRoot.get(appPackageRoot);
    }
    let path = findUp.sync('package.json', { cwd: appPackageRoot });
    this.packageJsonPathForAppPackageRoot.set(appPackageRoot, path);
    return path;
  }

  // to be called from within your build system. Returns the thing you should
  // push into your babel plugins list.
  //
  // owningPackageRoot is needed when the files you will process (1) all belongs
  // to one package, (2) will not be located in globally correct paths such that
  // normal node_modules resolution can find their dependencies. In other words,
  // owningPackageRoot is needed when you use this inside classic ember-cli, and
  // it's not appropriate inside embroider.
  babelPluginConfig(appOrAddonInstance?: any): PluginItem[] {
    let self = this;
    let owningPackageRoot = appOrAddonInstance ? appOrAddonInstance.root || appOrAddonInstance.project.root : null;
    let opts: State['opts'] = {
      // this is deliberately lazy because we want to allow everyone to finish
      // setting config before we generate the userConfigs
      get userConfigs() {
        return self.userConfigs;
      },
      get globalConfig() {
        return self.globalConfig;
      },
      owningPackageRoot,

      isDevelopingPackageRoots: [...this.isDevelopingPackageRoots],

      get appPackageRoot() {
        return self.appRoot;
      },

      // This is used as a signature so we can detect ourself among the plugins
      // emitted from v1 addons.
      embroiderMacrosConfigMarker: true,

      get mode() {
        return self.mode;
      },

      importSyncImplementation: this.importSyncImplementation,
    };

    let lockFilePath = MacrosConfig.getLockFilePath(self.appRoot);

    if (!lockFilePath) {
      lockFilePath = MacrosConfig.getPackageJsonPath(opts.appPackageRoot);
    }

    let lockFileBuffer = lockFilePath ? fs.readFileSync(lockFilePath) : 'no-cache-key';

    // @embroider/macros provides a macro called dependencySatisfies which checks if a given
    // package name satisfies a given semver version range. Due to the way babel caches this can
    // cause a problem where the macro plugin does not run (because it has been cached) but the version
    // of the dependency being checked for changes (due to installing a different version). This will lead to
    // the old evaluated state being used which might be invalid. This cache busting plugin keeps track of a
    // hash representing the lock file of the app and if it ever changes forces babel to rerun its plugins.
    // more information in issue #906
    let hash = crypto.createHash('sha256');
    hash = hash.update(lockFileBuffer);
    if (appOrAddonInstance) {
      // ensure that the actual running addon names and versions are accounted
      // for in the cache key; this ensures that we still invalidate the cache
      // when linking another project (e.g. ember-source) which would normally
      // not cause the lockfile to change;
      hash = hash.update(gatherAddonCacheKey(appOrAddonInstance.project));
    }
    let cacheKey = hash.digest('hex');

    return [
      [join(__dirname, 'babel', 'macros-babel-plugin.js'), opts],
      [babelCacheBustingPluginPath, { version: cacheKey }, `@embroider/macros cache buster: ${owningPackageRoot}`],
    ];
  }

  // provides the ast plugins that implement the macro system, in reverse order
  // for compatibility with the classic build, which historically always ran ast
  // plugins in backwards order.
  static astPlugins(owningPackageRoot?: string): {
    plugins: Function[];
    setConfig: (config: MacrosConfig) => void;
    lazyParams: FirstTransformParams;
  } {
    let result = this.transforms(owningPackageRoot);
    result.plugins.reverse();
    return result;
  }

  // todo: type adjuments here
  // provides the ast plugins that implement the macro system
  static transforms(owningPackageRoot?: string): {
    plugins: Function[];
    setConfig: (config: MacrosConfig) => void;
    lazyParams: FirstTransformParams;
  } {
    let configs: MacrosConfig | undefined;

    let lazyParams = {
      // this is deliberately lazy because we want to allow everyone to finish
      // setting config before we generate the userConfigs
      get configs() {
        if (!configs) {
          throw new Error(`Bug: @embroider/macros ast-transforms were not plugged into a MacrosConfig`);
        }
        return configs.userConfigs;
      },
      packageRoot: owningPackageRoot,
      get appRoot() {
        if (!configs) {
          throw new Error(`Bug: @embroider/macros ast-transforms were not plugged into a MacrosConfig`);
        }
        return configs.appRoot;
      },
    };

    let plugins = [makeFirstTransform(lazyParams), makeSecondTransform()];
    function setConfig(c: MacrosConfig) {
      configs = c;
    }
    return { plugins, setConfig, lazyParams };
  }

  private mergerFor(pkgRoot: string) {
    let entry = this.mergers.get(pkgRoot);
    if (entry) {
      return entry.merger;
    }
    return defaultMergerFor(pkgRoot);
  }

  private resolvePackage(fromPath: string, packageName?: string | undefined) {
    let us = this.packageCache.ownerOfFile(fromPath);
    if (!us) {
      throw new Error(`[Embroider:MacrosConfig] unable to determine which npm package owns the file ${fromPath}`);
    }
    if (packageName) {
      let target = this.packageCache.resolve(packageName, us);
      return this.packageCache.original(target);
    } else {
      return this.packageCache.original(us);
    }
  }

  finalize() {
    this._configWritable = false;
  }
}

function defaultMergerFor(pkgRoot: string) {
  return function defaultMerger(configs: object[], { sourceOfConfig }: { sourceOfConfig: SourceOfConfig }): object {
    let [ownConfigs, otherConfigs] = partition(configs, c => sourceOfConfig(c as object).root === pkgRoot);
    return Object.assign({}, ...ownConfigs, ...otherConfigs);
  };
}

function isSerializable(obj: object): boolean {
  if (isScalar(obj)) {
    return true;
  }

  if (Array.isArray(obj)) {
    return !obj.some((arrayItem: any) => !isSerializable(arrayItem));
  }

  if (isPlainObject(obj)) {
    for (let property in obj) {
      let value = obj[property] as any;
      if (!isSerializable(value)) {
        return false;
      }
    }

    return true;
  }

  console.error('non serializable item found in config:', obj);
  return false;
}

function isScalar(val: any): boolean {
  return (
    typeof val === 'undefined' ||
    typeof val === 'string' ||
    typeof val === 'boolean' ||
    typeof val === 'number' ||
    val === null
  );
}

function isPlainObject(obj: any): obj is Record<string, any> {
  return typeof obj === 'object' && obj.constructor === Object && obj.toString() === '[object Object]';
}
