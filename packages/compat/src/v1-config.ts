import Plugin, { Tree } from "broccoli-plugin";
import { join } from 'path';
import { readFileSync, outputFileSync } from "fs-extra";
import { EmberENV } from '@embroider/core';

export interface ConfigContents {
  modulePrefix: string;
  EmberENV: EmberENV;
  APP: unknown;
}

export class V1Config extends Plugin {
  private lastConfig: ConfigContents | undefined;
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

export class WriteV1Config extends Plugin {
  private lastContents: string | undefined;
  constructor(private inputTree: V1Config, private storeConfigInMeta: boolean, private appName: string) {
    super([inputTree], {
      persistentOutput: true
    });
  }
  build() {
    let filename = join(this.outputPath, 'config/environment.js');
    let contents;
    if (this.storeConfigInMeta) {
      contents = metaLoader(this.appName);
    } else {
      contents = `export default ${JSON.stringify(this.inputTree.readConfig())};`;
    }
    if (!this.lastContents || this.lastContents !== contents) {
      outputFileSync(filename, contents);
    }
    this.lastContents = contents;
  }
}

function metaLoader(appName: string) {
  return `
  let config, metaName;
  try {
    metaName = '${appName}/config/environment';
    let rawConfig = document.querySelector('meta[name="' + metaName + '"]').getAttribute('content');
    config = JSON.parse(unescape(rawConfig));
  }
  catch(err) {
    throw new Error('Could not read config from meta tag with name "' + metaName + '".');
  }
  export default config;
  `;
}
