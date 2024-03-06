import Plugin from 'broccoli-plugin';
import type { Node } from 'broccoli-node-api';
import { readFileSync } from 'fs-extra';
import { join } from 'path';

export default class ContentForConfig extends Plugin {
  // The object keys are the content types and each value is the HTML
  // code that should replace the corresponding {{content-for}}
  // Example: { body: '<p>This snippet replaces content-for \"body\" in the app index.html</p>' }
  private contentFor: any;

  private defaultContentForTypes = [
    'head',
    'test-head',
    'head-footer',
    'test-head-footer',
    'body',
    'test-body',
    'body-footer',
    'test-body-footer',
    'config-module',
    'app-boot',
  ];

  constructor(configTree: Node, private options: any) {
    super([configTree], {
      annotation: 'embroider:content-for-config',
      persistentOutput: true,
      needsCache: false,
    });
  }

  readContents() {
    if (!this.contentFor) {
      throw new Error(`ContentForConfig not available until after the build`);
    }
    return this.contentFor;
  }

  build() {
    if (!this.contentFor) this.contentFor = {};
    const availableContentForTypes = this.options.availableContentForTypes ?? [];
    const extendedContentTypes = new Set([...this.defaultContentForTypes, ...availableContentForTypes]);

    extendedContentTypes.forEach(contentType => {
      const matchExp = this.options.pattern.match;
      if (!this.contentFor[contentType]) {
        let contents = this.options.pattern.replacement.call(null, this.getAppConfig(), matchExp, contentType);
        this.contentFor[contentType] = contents;
      }
    });
  }

  getAppConfig() {
    let config = readFileSync(join(this.inputPaths[0], this.options.configPath), { encoding: 'utf8' });
    return JSON.parse(config);
  }
}
