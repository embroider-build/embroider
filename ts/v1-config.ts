import Plugin, { Tree } from "broccoli-plugin";
import { join } from 'path';
import { readFileSync } from "fs";

export default class V1Config extends Plugin {
  private lastConfig: string;
  constructor(configTree: Tree, private env: string) {
    super([configTree], {});
  }
  build() {
    this.lastConfig = JSON.parse(readFileSync(join(this.inputPaths[0], 'environments', `${this.env}.json`), 'utf8'));
  }
  readConfig() {
    if (!this.lastConfig) {
      throw new Error(`V1Config not available until after the build`);
    }
    return this.lastConfig;
  }
}
