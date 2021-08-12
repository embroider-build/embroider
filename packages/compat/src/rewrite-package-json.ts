import Plugin from 'broccoli-plugin';
import { Node } from 'broccoli-node-api';
import { writeFileSync } from 'fs';
import { join } from 'path';

export default class RewritePackageJSON extends Plugin {
  constructor(inputTree: Node, private getPackageJSON: () => any) {
    super([inputTree], {
      annotation: 'embroider:core:rewrite-package-json',
      persistentOutput: true,
      needsCache: false,
    });
  }

  build() {
    writeFileSync(join(this.outputPath, 'package.json'), JSON.stringify(this.getPackageJSON(), null, 2), 'utf8');
  }
}
