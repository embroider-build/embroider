import Funnel from 'broccoli-funnel';
import { existsSync } from 'fs';
import { join } from 'path';

/*
  This is a really simple implementation that you probably shouldn't copy unless
  your needs are equally simple.
*/

export default class MultiFunnel extends Funnel {
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
