import { join } from 'path';
import type { PluginItem } from '@babel/core';
import { PackageCache, getOrCreate } from '@embroider/shared-internals';
import { makeFirstTransform, makeSecondTransform } from './glimmer/ast-transform';
import State from './babel/state';
import partition from 'lodash/partition';

const packageCache = new PackageCache();

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

// Do not change this type signature without pondering deeply the mysteries of
// being compatible with unwritten future versions of this library.
type GlobalSharedState = WeakMap<
  any,
  {
    configs: Map<string, object[]>;
    configSources: WeakMap<object, string>;
    mergers: Map<string, { merger: Merger; fromPath: string }>;
  }
>;

// this is a module-scoped cache. If multiple callers ask _this copy_ of
// @embroider/macros for a shared MacrosConfig, they'll all get the same one.
// And if somebody asks a *different* copy of @embroider/macros for the shared
// MacrosConfig, it will have its own instance with its own code, but will still
// share the GlobalSharedState beneath.
let localSharedState: WeakMap<any, MacrosConfig> = new WeakMap();

export default class MacrosConfig {
  static for(key: any): MacrosConfig {
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
    } else {
      shared = {
        configs: new Map(),
        configSources: new WeakMap(),
        mergers: new Map(),
      };
      g.__embroider_macros_global__.set(key, shared);
    }

    let config = new MacrosConfig();
    config.configs = shared.configs;
    config.configSources = shared.configSources;
    config.mergers = shared.mergers;
    localSharedState.set(key, config);
    return config;
  }

  private mode: 'compile-time' | 'run-time' = 'compile-time';
  private globalConfig: { [key: string]: unknown } = {};

  private isDevelopingPackageRoots: Set<string> = new Set();
  private appPackageRoot: string | undefined;

  enableRuntimeMode() {
    if (this.mode !== 'run-time') {
      if (!this._configWritable) {
        throw new Error(`[Embroider:MacrosConfig] attempted to enableRuntimeMode after configs have been finalized`);
      }
      this.mode = 'run-time';
    }
  }

  enableAppDevelopment(appPackageRoot: string) {
    if (!appPackageRoot) {
      throw new Error(`must provide appPackageRoot`);
    }
    if (this.appPackageRoot) {
      if (this.appPackageRoot !== appPackageRoot && this.moves.get(this.appPackageRoot) !== appPackageRoot) {
        throw new Error(`bug: conflicting appPackageRoots ${this.appPackageRoot} vs ${appPackageRoot}`);
      }
    } else {
      if (!this._configWritable) {
        throw new Error(`[Embroider:MacrosConfig] attempted to enableAppDevelopment after configs have been finalized`);
      }
      this.appPackageRoot = appPackageRoot;
      this.isDevelopingPackageRoots.add(appPackageRoot);
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

  private constructor() {
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

  private _configWritable = true;
  private configs: Map<string, object[]> = new Map();
  private configSources: WeakMap<object, string> = new WeakMap();
  private mergers: Map<string, { merger: Merger; fromPath: string }> = new Map();

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
      let sourceOfConfig = makeConfigSourcer(this.configSources);
      for (let [pkgRoot, configs] of this.configs) {
        let combined: object;
        if (configs.length > 1) {
          combined = this.mergerFor(pkgRoot)(configs, { sourceOfConfig });
        } else {
          combined = configs[0];
        }
        userConfigs[pkgRoot] = combined;
      }
      for (let [oldPath, newPath] of this.moves) {
        userConfigs[newPath] = userConfigs[oldPath];
      }
      this.cachedUserConfigs = userConfigs;
    }

    return this.cachedUserConfigs;
  }

  // to be called from within your build system. Returns the thing you should
  // push into your babel plugins list.
  //
  // owningPackageRoot is needed when the files you will process (1) all belongs
  // to one package, (2) will not be located in globally correct paths such that
  // normal node_modules resolution can find their dependencies. In other words,
  // owningPackageRoot is needed when you use this inside classic ember-cli, and
  // it's not appropriate inside embroider.
  babelPluginConfig(owningPackageRoot?: string): PluginItem {
    let self = this;
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

      isDevelopingPackageRoots: [...this.isDevelopingPackageRoots].map(root => this.moves.get(root) || root),
      appPackageRoot: this.appPackageRoot ? this.moves.get(this.appPackageRoot) || this.appPackageRoot : '',

      // This is used as a signature so we can detect ourself among the plugins
      // emitted from v1 addons.
      embroiderMacrosConfigMarker: true,

      get mode() {
        return self.mode;
      },

      importSyncImplementation: this.importSyncImplementation,
    };
    return [join(__dirname, 'babel', 'macros-babel-plugin.js'), opts];
  }

  static astPlugins(owningPackageRoot?: string): {
    plugins: Function[];
    setConfig: (config: MacrosConfig) => void;
    getConfigForPlugin(): any;
  } {
    let configs: MacrosConfig | undefined;
    let plugins = [
      makeFirstTransform({
        // this is deliberately lazy because we want to allow everyone to finish
        // setting config before we generate the userConfigs
        get userConfigs() {
          if (!configs) {
            throw new Error(`Bug: @embroider/macros ast-transforms were not plugged into a MacrosConfig`);
          }
          return configs.userConfigs;
        },
        baseDir: owningPackageRoot,
      }),
      makeSecondTransform(),
    ].reverse();
    function setConfig(c: MacrosConfig) {
      configs = c;
    }
    function getConfigForPlugin() {
      if (!configs) {
        throw new Error(`Bug: @embroider/macros ast-transforms were not plugged into a MacrosConfig`);
      }

      return configs.userConfigs;
    }
    return { plugins, setConfig, getConfigForPlugin };
  }

  private mergerFor(pkgRoot: string) {
    let entry = this.mergers.get(pkgRoot);
    if (entry) {
      return entry.merger;
    }
    return defaultMergerFor(pkgRoot);
  }

  // this exists because @embroider/compat rewrites and moves v1 addons, and
  // their macro configs need to follow them to their new homes.
  packageMoved(oldPath: string, newPath: string) {
    if (!this._configWritable) {
      throw new Error(`[Embroider:MacrosConfig] attempted to call packageMoved after configs have been finalized`);
    }

    this.moves.set(oldPath, newPath);
  }

  private moves: Map<string, string> = new Map();

  getConfig(fromPath: string, packageName: string) {
    return this.userConfigs[this.resolvePackage(fromPath, packageName).root];
  }

  getOwnConfig(fromPath: string) {
    return this.userConfigs[this.resolvePackage(fromPath, undefined).root];
  }

  private resolvePackage(fromPath: string, packageName?: string | undefined) {
    let us = packageCache.ownerOfFile(fromPath);
    if (!us) {
      throw new Error(`[Embroider:MacrosConfig] unable to determine which npm package owns the file ${fromPath}`);
    }
    if (packageName) {
      return packageCache.resolve(packageName, us);
    } else {
      return us;
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

function makeConfigSourcer(configSources: WeakMap<object, string>): SourceOfConfig {
  return config => {
    let fromPath = configSources.get(config);
    if (!fromPath) {
      throw new Error(`unknown object passed to sourceOfConfig(). You can only pass back the configs you were given.`);
    }
    let maybePkg = packageCache.ownerOfFile(fromPath);
    if (!maybePkg) {
      throw new Error(
        `bug: unexpected error, we always check that fromPath is owned during internalSetConfig so this should never happen`
      );
    }
    let pkg = maybePkg;
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
