import Plugin from 'broccoli-plugin';
import { writeJSONSync } from 'fs-extra';
import { join } from 'path';

export default class extends Plugin {
  private built = false;

  constructor(private name: string) {
    super([], {
      annotation: 'empty-package-tree',
      persistentOutput: true,
      needsCache: false,
    });
  }
  build() {
    if (!this.built) {
      writeJSONSync(join(this.outputPath, 'package.json'), {
        name: this.name,
      });
    }
  }
}
