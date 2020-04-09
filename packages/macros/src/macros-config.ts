import { join } from 'path';
import { PluginItem } from '@babel/core';
import { PackageCache, getOrCreate } from '@embroider/core';
import { makeFirstTransform, makeSecondTransform } from './glimmer/ast-transform';
import State from './babel/state';

const packageCache = new PackageCache();

export type Merger = (configs: unknown[]) => unknown;

// Do not change this type signature without pondering deeply the mysteries of
// being compatible with unwritten future versions of this library.
type GlobalSharedState = WeakMap<
  any,
  {
    configs: Map<string, unknown[]>;
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

    let g = (global as any) as { __embroider_macros_global__: GlobalSharedState | undefined };
    if (!g.__embroider_macros_global__) {
      g.__embroider_macros_global__ = new WeakMap();
    }

    let shared = g.__embroider_macros_global__.get(key);
    if (!shared) {
      shared = {
        configs: new Map(),
        mergers: new Map(),
      };
      g.__embroider_macros_global__.set(key, shared);
    }

    let config = new MacrosConfig();
    config.configs = shared.configs;
    config.mergers = shared.mergers;
    localSharedState.set(key, config);
    return config;
  }

  private mode: 'compile-time' | 'run-time' = 'compile-time';

  enableRuntimeMode() {
    this.mode = 'run-time';
  }

  private constructor() {}

  private _configWritable = true;
  private configs: Map<string, unknown[]> = new Map();
  private mergers: Map<string, { merger: Merger; fromPath: string }> = new Map();

  // Registers a new source of configuration to be given to the named package.
  // Your config type must be json-serializable. You must always set fromPath to
  // `__filename`.
  setConfig(fromPath: string, packageName: string, config: unknown) {
    return this.internalSetConfig(fromPath, packageName, config);
  }

  // Registers a new source of configuration to be given to your own package.
  // Your config type must be json-serializable. You must always set fromPath to
  // `__filename`.
  setOwnConfig(fromPath: string, config: unknown) {
    return this.internalSetConfig(fromPath, undefined, config);
  }

  private internalSetConfig(fromPath: string, packageName: string | undefined, config: unknown) {
    if (!this._configWritable) {
      throw new Error(
        `[Embroider:MacrosConfig] attempted to set config after configs have been finalized from: '${fromPath}'`
      );
    }

    let targetPackage = this.resolvePackage(fromPath, packageName);
    let peers = getOrCreate(this.configs, targetPackage.root, () => []);
    peers.push(config);
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
        `[Embroider:MacrosConfig] conflicting mergers registered for package ${targetPackage.name} at ${
          targetPackage.root
        }. See ${other.fromPath} and ${fromPath}.`
      );
    }
    this.mergers.set(targetPackage.root, { merger, fromPath });
  }

  private cachedUserConfigs: { [packageRoot: string]: unknown } | undefined;

  private get userConfigs() {
    if (this._configWritable) {
      throw new Error('[Embroider:MacrosConfig] cannot read userConfigs until MacrosConfig has been finalized.');
    }

    if (!this.cachedUserConfigs) {
      let userConfigs: { [packageRoot: string]: unknown } = {};
      for (let [pkgRoot, configs] of this.configs) {
        let combined: unknown;
        if (configs.length > 1) {
          combined = this.mergerFor(pkgRoot)(configs);
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
      owningPackageRoot,

      // This is used as a signature so we can detect ourself among the plugins
      // emitted from v1 addons.
      embroiderMacrosConfigMarker: true,

      get mode() {
        return self.mode;
      },
    };
    return [join(__dirname, 'babel', 'macros-babel-plugin.js'), opts];
  }

  static astPlugins(owningPackageRoot?: string): { plugins: Function[]; setConfig: (config: MacrosConfig) => void } {
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
    return { plugins, setConfig };
  }

  private mergerFor(pkgRoot: string) {
    let entry = this.mergers.get(pkgRoot);
    if (entry) {
      return entry.merger;
    }
    return defaultMerger;
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

  resolvePackage(fromPath: string, packageName?: string | undefined) {
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

function defaultMerger(configs: unknown[]): unknown {
  return Object.assign({}, ...configs);
}
