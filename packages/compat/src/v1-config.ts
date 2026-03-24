import Plugin from 'broccoli-plugin';
import type { Node } from 'broccoli-node-api';
import { join } from 'path';
import { readFileSync, outputFileSync } from 'fs-extra';

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

export class WriteV1Config extends Plugin {
  private lastContents: string | undefined;
  constructor(private inputTree: V1Config, private storeConfigInMeta: boolean, private testInputTree?: V1Config) {
    super([inputTree, testInputTree as V1Config].filter(Boolean), {
      persistentOutput: true,
      needsCache: false,
    });
  }
  build() {
    let filename = join(this.outputPath, 'config/environment.js');
    let contents;
    if (this.storeConfigInMeta) {
      contents = metaLoader();
    } else {
      if (this.testInputTree) {
        contents = `
        import { isTesting } from '@embroider/macros';
        let env;
        if (isTesting()) {
          env = ${JSON.stringify(this.testInputTree.readConfig())};
        } else {
          env = ${JSON.stringify(this.inputTree.readConfig())};
        }
        export default env;
        `;
      } else {
        contents = `export default ${JSON.stringify(this.inputTree.readConfig())};`;
      }
    }
    if (!this.lastContents || this.lastContents !== contents) {
      outputFileSync(filename, contents);
    }
    this.lastContents = contents;
  }
}

function metaLoader() {
  // Supporting config content as JS Module.
  // Wrapping the content with immediate invoked function as
  // replaced content for config-module was meant to support AMD module.
  return `
    export default (function() {
      {{content-for 'config-module'}}
    })().default;
  `;
}
