import Plugin from 'broccoli-plugin';
import { writeJSONSync } from 'fs-extra';
import { join } from 'path';

export default class extends Plugin {
  private built = false;

  constructor() {
    super([], {
      annotation: 'empty-package-tree',
      persistentOutput: true,
    });
  }
  build() {
    if (!this.built) {
      writeJSONSync(join(this.outputPath, 'package.json'), {});
    }
  }
}
