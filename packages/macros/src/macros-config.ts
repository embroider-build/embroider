import { join } from "path";
import { PluginItem } from "@babel/core";
import { PackageCache, Package } from "@embroider/core";
import { makeFirstTransform, makeSecondTransform } from './glimmer/ast-transform';

const packageCache = new PackageCache();

export type Merger = (configs: unknown[]) => unknown;

// Do not change the public signature of this class without pondering deeply the
// mysteries of being compatible with unwritten future versions of this library.
class GlobalSharedState {
  configs: Map<string, unknown[]> = new Map();
  mergers: Map<string, { merger: Merger, fromPath: string }> = new Map();
}

// this is a module-scoped cache. If multiple callers ask _this copy_ of
// @embroider/macros for the shared MacrosConfig, they'll all get the same one.
// And if somebody asks a *different* copy of @embroider/macros for the shared
// MacrosConfig, it will have its own instance with its own code, but will still
// share the GlobalSharedState beneath.
let localSharedState: MacrosConfig | undefined;

export default class MacrosConfig {
  static shared(): MacrosConfig {
    if (!localSharedState) {
      let g = global as any as { __embroider_macros_global__: GlobalSharedState | undefined };
      if (!g.__embroider_macros_global__) {
        g.__embroider_macros_global__ = new GlobalSharedState();
      }
      localSharedState = new MacrosConfig();
      localSharedState.configs = g.__embroider_macros_global__.configs;
      localSharedState.mergers = g.__embroider_macros_global__ .mergers;
    }
    return localSharedState;
  }

  private configs: Map<string, unknown[]> = new Map();
  private mergers: Map<string, { merger: Merger, fromPath: string }> = new Map();

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
    if (this.cachedUserConfigs) {
      throw new Error(`attempted to set config after we have already emitted our config`);
    }
    let targetPackage = this.resolvePackage(fromPath, packageName);
    let peers = this.configs.get(targetPackage.root);
    if (peers) {
      peers.push(config);
    } else {
      this.configs.set(targetPackage.root, [config]);
    }
  }

  // Allows you to set the merging strategy used for your package's config. The
  // merging strategy applies when multiple other packages all try to send
  // configuration to you.
  useMerger(fromPath: string, merger: Merger) {
    if (this.cachedUserConfigs) {
      throw new Error(`attempted to call useMerger after we have already emitted our config`);
    }
    let targetPackage = this.resolvePackage(fromPath, undefined);
    let other = this.mergers.get(targetPackage.root);
    if (other) {
      throw new Error(`conflicting mergers registered for package ${targetPackage.name} at ${targetPackage.root}. See ${other.fromPath} and ${fromPath}.`);
    }
    this.mergers.set(targetPackage.root, { merger, fromPath });
  }

  private cachedUserConfigs: { [packageRoot: string]: unknown } | undefined;

  private get userConfigs() {
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
    return [join(__dirname, 'babel', 'macros-babel-plugin.js'), {
      // this is deliberately lazy because we want to allow everyone to finish
      // setting config before we generate the userConfigs
      get userConfigs() { return self.userConfigs; },
      owningPackageRoot,

      // This is used as a signature so we can detect ourself among the plugins
      // emitted from v1 addons.
      embroiderMacrosConfigMarker: true,
    }];
  }

  astPlugins(owningPackageRoot?: string): Function[] {
    return [makeFirstTransform(this, owningPackageRoot), makeSecondTransform()];
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
    let config = this.userConfigs[oldPath];
    if (config) {
      this.userConfigs[newPath] = config;
    }
  }

  getConfig(fromPath: string, packageName: string) {
    return this.userConfigs[this.resolvePackage(fromPath, packageName).root];
  }

  getOwnConfig(fromPath: string) {
    return this.userConfigs[this.resolvePackage(fromPath, undefined).root];
  }

  resolvePackage(fromPath: string, packageName?: string | undefined) {
    let us = packageCache.ownerOfFile(fromPath);
    if (!us) {
      throw new Error(`unable to determine which npm package owns the file ${fromPath}`);
    }
    if (packageName) {
      return packageCache.resolve(packageName, us);
    } else {
      return us;
    }
  }
}

function defaultMerger(configs: unknown[]): unknown {
  return Object.assign({}, ...configs);
}
