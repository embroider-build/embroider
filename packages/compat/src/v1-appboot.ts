import Plugin, { Tree } from 'broccoli-plugin';
import { join } from 'path';
import { readFileSync, outputFileSync } from 'fs-extra';

export class WriteV1AppBoot extends Plugin {
  private lastContents: string | undefined;
  constructor() {
    super([], {
      persistentOutput: true,
    });
  }
  build() {
    let filename = join(this.outputPath, 'config/app-boot.js');
    let contents = `{{content-for "app-boot"}}`;
    if (!this.lastContents || this.lastContents !== contents) {
      outputFileSync(filename, contents);
    }
    this.lastContents = contents;
  }
}

export class ReadV1AppBoot extends Plugin {
  private appBoot: string | undefined;
  constructor(appBootTree: Tree) {
    super([appBootTree], {
      persistentOutput: true,
    });
  }
  build() {
    this.appBoot = readFileSync(join(this.inputPaths[0], `config/app-boot.js`), 'utf8');
  }

  readAppBoot() {
    if (!this.appBoot) {
      throw new Error(`AppBoot not available until after the build`);
    }
    return this.appBoot;
  }
}
