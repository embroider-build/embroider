import { Node } from 'broccoli-node-api';
import { resolve } from 'path';
import { ensureDirSync, realpathSync } from 'fs-extra';
import { Stage, WaitForTrees } from '@embroider/core';
import TreeSync from 'tree-sync';
import CompatApp from './compat-app';
import { convertLegacyAddons } from './standalone-addon-build';

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
  private treeSync: TreeSync | undefined;
  readonly inputPath: string;

  private destDir: string;
  private addons: Node;

  constructor(compatApp: CompatApp) {
    // we want this to be stable across builds, because it becomes part of the
    // path to all of the files that the stage3 packager sees, and we want to
    // benefit from on-disk caching in stage3 packagers.
    ensureDirSync(compatApp.options.workspaceDir!);
    this.destDir = realpathSync(compatApp.options.workspaceDir!);
    this.addons = convertLegacyAddons(compatApp);
    this.inputPath = compatApp.root;
  }

  get tree(): Node {
    return new WaitForTrees({ addons: this.addons }, '@embroider/compat/addons', this.build.bind(this));
  }

  async ready(): Promise<{ outputPath: string }> {
    return {
      outputPath: this.destDir,
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
    if (!this.treeSync) {
      this.treeSync = new TreeSync(addons, resolve(this.inputPath, 'node_modules/.embroider/rewritten-packages'), {
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
  }
}
