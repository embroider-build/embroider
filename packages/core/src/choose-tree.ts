import Plugin, { Tree } from 'broccoli-plugin';
import { join } from 'path';
import { existsSync, removeSync, ensureDirSync } from 'fs-extra';
import symlinkOrCopy from 'symlink-or-copy';

interface ChooseTreeOptions {
  annotation?: string;
  srcDir: (inputPath: string) => Promise<string> | string;
}

export default class ChooseTree extends Plugin {
  private srcDirFn: ChooseTreeOptions['srcDir'];
  private lastSrcDir: string | undefined;

  constructor(inputTree: Tree, options: ChooseTreeOptions) {
    super([inputTree], {
      annotation: options.annotation,
      persistentOutput: true,
      needsCache: false,
    });
    this.srcDirFn  = options.srcDir;
  }

  private async computeSrcDir() {
    let value = await this.srcDirFn(this.inputPaths[0]);
    if (value) {
      return join(this.inputPaths[0], value);
    }
  }

  async build() {
    let src = await this.computeSrcDir();
    if (src === this.lastSrcDir) {
      // nothing to do, we're already linked to the right place.
      return;
    }
    removeSync(this.outputPath);
    if (src && existsSync(src)) {
      // link to the source
      symlinkOrCopy.sync(src, this.outputPath);
      this.lastSrcDir = src;
    } else {
      // the source doesn't exist, so make an empty output dir
      ensureDirSync(this.outputPath);
      this.lastSrcDir = null;
    }
  }
}
