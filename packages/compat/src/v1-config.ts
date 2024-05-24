import Plugin from 'broccoli-plugin';
import type { Node } from 'broccoli-node-api';
import { join } from 'path';
import { readFileSync } from 'fs-extra';

export interface ConfigContents {
  modulePrefix: string;
  podModulePrefix?: string;
  EmberENV: unknown;
  APP: unknown;
  rootURL: string;
}

export class V1Config extends Plugin {
  private lastConfig: ConfigContents | undefined;
  constructor(configTree: Node, private env: string) {
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
