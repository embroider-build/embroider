import Funnel, { Options } from 'broccoli-funnel';
import { Tree } from 'broccoli-plugin';
import { existsSync } from 'fs';
import { join } from 'path';

/*
  This is a really simple implementation that you probably shouldn't copy unless
  your needs are equally simple.
*/

interface MultiOptions extends Options {
  srcDirs: string[];
}

export default class MultiFunnel extends Funnel {
  constructor(inputTree: Tree, options: MultiOptions) {
    super(inputTree, options);
  }
  build() {
    for (let dir of this.srcDirs) {
      if (existsSync(join(this.inputPaths[0], dir))) {
        this.srcDir = dir;
        break;
      }
    }
    return super.build();
  }
}
