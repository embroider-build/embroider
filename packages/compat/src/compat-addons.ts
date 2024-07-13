import type { Node } from 'broccoli-node-api';
import { resolve } from 'path';
import type { Stage } from '@embroider/core';
import { locateEmbroiderWorkingDir, RewrittenPackageCache, WaitForTrees } from '@embroider/core';
import TreeSync from 'tree-sync';
import type CompatApp from './compat-app';
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

  private addons: Node;

  constructor(private compatApp: CompatApp) {
    this.addons = convertLegacyAddons(compatApp);
    this.inputPath = compatApp.root;
  }

  get tree(): Node {
    return new WaitForTrees({ addons: this.addons }, '@embroider/compat/addons', this.build.bind(this));
  }

  async ready(): Promise<{ outputPath: string }> {
    return {
      outputPath: resolve(locateEmbroiderWorkingDir(this.compatApp.root), '..', '..', 'tmp', 'rewritten-app'),
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
      this.treeSync = new TreeSync(
        addons,
        resolve(locateEmbroiderWorkingDir(this.compatApp.root), 'rewritten-packages')
      );
    }

    if (
      !this.didBuild || // always copy on the first build
      changedMap.get(addons)
    ) {
      this.treeSync.sync();
      RewrittenPackageCache.shared('embroider', this.compatApp.root).invalidateIndex();
    }
    this.didBuild = true;
  }
}
