import { join } from "path";
import { PluginItem } from "@babel/core";
import { PackageCache, Package } from "@embroider/core";

const packageCache = new PackageCache();

export default class MacrosConfig {
  private configs: Map<Package, unknown[]> = new Map();
  private mergers: Map<Package, { merger: Merger, fromPath: string }> = new Map();

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
    let targetPackage = this.targetPackage(fromPath, packageName);
    let peers = this.configs.get(targetPackage);
    if (peers) {
      peers.push(config);
    } else {
      this.configs.set(targetPackage, [config]);
    }
  }

  // Allows you to set the merging strategy used for your package's config. The
  // merging strategy applies when multiple other packages all try to send
  // configuration to you.
  useMerger(fromPath: string, merger: Merger) {
    if (this.cachedUserConfigs) {
      throw new Error(`attempted to call useMerger after we have already emitted our config`);
    }
    let targetPackage = this.targetPackage(fromPath, undefined);
    let other = this.mergers.get(targetPackage);
    if (other) {
      throw new Error(`conflicting mergers registered for package ${targetPackage.name} at ${targetPackage.root}. See ${other.fromPath} and ${fromPath}.`);
    }
    this.mergers.set(targetPackage, { merger, fromPath });
  }

  private cachedUserConfigs: { [packageRoot: string]: unknown } | undefined;

  private get userConfigs() {
    if (!this.cachedUserConfigs) {
      let userConfigs: { [packageRoot: string]: unknown } = {};
      for (let [pkg, configs] of this.configs) {
        let combined: unknown;
        if (configs.length > 1) {
          combined = this.mergerFor(pkg)(configs);
        } else {
          combined = configs[0];
        }
        userConfigs[pkg.root] = combined;
      }
      this.cachedUserConfigs = userConfigs;
    }
    return this.cachedUserConfigs;
  }

  // to be called from within your build system. Returns the thing you should push
  // into your babel plugins list.
  babelPluginConfig(): PluginItem {
    return [join(__dirname, 'babel', 'macros-babel-plugin.js'), { userConfigs: this.userConfigs }];
  }

  private mergerFor(pkg: Package) {
    let entry = this.mergers.get(pkg);
    if (entry) {
      return entry.merger;
    }
    return defaultMerger;
  }

  getConfig(fromPath: string, packageName: string) {
    return this.userConfigs[this.targetPackage(fromPath, packageName).root];
  }

  getOwnConfig(fromPath: string) {
    return this.userConfigs[this.targetPackage(fromPath, undefined).root];
  }

  private targetPackage(fromPath: string, packageName: string | undefined) {
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

export type Merger = (configs: unknown[]) => unknown;

function defaultMerger(configs: unknown[]): unknown {
  return Object.assign({}, ...configs);
}
