import { join } from "path";
import { PluginItem } from "@babel/core";
import { PackageCache, Package } from "@embroider/core";

const packageCache = new PackageCache();

export default class MacrosConfig {
  private configs: Map<Package, unknown[]> = new Map();
  private mergers: Map<Package, { merger: Merger, fromPath: string }> = new Map();
  private emittedBabelConfig = false;

  // Registers a new source of configuration to be given to the named package.
  // Your config type must be json-serializable. You must always set fromPath to
  // `__filename`.
  setConfig(fromPath: string, packageName: string, config: unknown) {
    if (this.emittedBabelConfig) {
      throw new Error(`attempted to call setConfig after we have already emitted our babel config`);
    }
    let targetPackage = this.targetPackage(fromPath, packageName);
    let peers = this.configs.get(targetPackage);
    if (peers) {
      peers.push(config);
    } else {
      this.configs.set(targetPackage, [config]);
    }
  }

  // Allows you to set the merging strategy for a given package. The merging
  // strategy applies when multiple other packages all try to send configuration
  // to the same target package.
  useMerger(fromPath: string, packageName: string, merger: Merger) {
    if (this.emittedBabelConfig) {
      throw new Error(`attempted to call useMerger after we have already emitted our babel config`);
    }
    let targetPackage = this.targetPackage(fromPath, packageName);
    let other = this.mergers.get(targetPackage);
    if (other) {
      throw new Error(`conflicting mergers registered for package ${targetPackage.name} at ${targetPackage.root}. See ${other.fromPath} and ${fromPath}.`);
    }
    this.mergers.set(targetPackage, { merger, fromPath });
  }

  // to be called from within your build system. Returns the thing you should push
  // into your babel plugins list.
  babelPluginConfig(): PluginItem {
    this.emittedBabelConfig = true;
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
    return [join(__dirname, 'macros-babel-plugin.js'), { userConfigs }];
  }

  private mergerFor(pkg: Package) {
    let entry = this.mergers.get(pkg);
    if (entry) {
      return entry.merger;
    }
    return defaultMerger;
  }

  private targetPackage(fromPath: string, packageName: string) {
    let us = packageCache.ownerOfFile(fromPath);
    if (!us) {
      throw new Error(`unable to determine which npm package owns the file ${fromPath}`);
    }
    return packageCache.resolve(packageName, us);
  }
}

export type Merger = (configs: unknown[]) => unknown;

function defaultMerger(configs: unknown[]): unknown {
  return Object.assign({}, ...configs);
}
