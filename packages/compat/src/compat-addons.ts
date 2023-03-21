import { Node } from 'broccoli-node-api';
import { emptyDirSync, ensureDirSync, realpathSync } from 'fs-extra';
import { Stage, PackageCache, WaitForTrees, EmberAppInstance } from '@embroider/core';
import { Memoize } from 'typescript-memoize';
import Options, { optionsWithDefaults } from './options';
import TreeSync from 'tree-sync';
import { convertLegacyAddons } from '.';
import V1InstanceCache from './v1-instance-cache';
import { resolve } from 'path';

// This build stage expects to be run with broccoli memoization enabled in order
// to get good rebuild performance. We turn it on by default here, but you can
// still explicitly turn it off by setting the env var to "false".
//
// As for safetly mutating process.env: broccoli doesn't read this until a Node
// executes its build hook, so as far as I can tell there's no way we could set
// this too late.
if (typeof process.env.BROCCOLI_ENABLED_MEMOIZE === 'undefined') {
  process.env.BROCCOLI_ENABLED_MEMOIZE = 'true';
}

export default class CompatAddons implements Stage {
  private didBuild = false;
  private destDir: string;
  private treeSync: TreeSync | undefined;
  readonly inputPath: string;

  private addons: Node;

  constructor(legacyEmberAppInstance: EmberAppInstance, maybeOptions?: Options) {
    let options = optionsWithDefaults(maybeOptions);

    // we want this to be stable across builds, because it becomes part of the
    // path to all of the files that the stage3 packager sees, and we want to
    // benefit from on-disk caching in stage3 packagers.
    ensureDirSync(options.workspaceDir!);
    this.destDir = realpathSync(options.workspaceDir!);
    this.addons = convertLegacyAddons(legacyEmberAppInstance, maybeOptions);
    this.inputPath = V1InstanceCache.forApp(legacyEmberAppInstance, options).app.root;
  }

  get tree(): Node {
    return new WaitForTrees({ addons: this.addons }, '@embroider/compat/addons', this.build.bind(this));
  }

  async ready(): Promise<{ outputPath: string; packageCache: PackageCache }> {
    await this.deferReady.promise;
    return {
      outputPath: this.destDir,
      packageCache: PackageCache.shared('embroider-unified', this.inputPath),
    };
  }

  private async build(
    {
      addons,
    }: {
      addons: string;
    },
    changedMap: Map<string, boolean>
  ) {
    // empty the directory only on the first pass
    if (!this.didBuild) {
      emptyDirSync(this.destDir);
    }

    if (!this.treeSync) {
      this.treeSync = new TreeSync(addons, resolve(this.inputPath, 'node_modules/.embroider/addons'), {
        ignore: ['**/node_modules'],
      });
    }

    if (
      !this.didBuild || // always copy on the first build
      changedMap.get(addons)
    ) {
      this.treeSync.sync();
    }
    this.didBuild = true;
    this.deferReady.resolve();
  }

  @Memoize()
  private get deferReady() {
    let resolve: Function;
    let promise: Promise<void> = new Promise(r => (resolve = r));
    return { resolve: resolve!, promise };
  }
}
