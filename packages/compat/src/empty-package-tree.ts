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
        '//': 'This empty package was created by embroider. If you are having issues resolving this package and you have followed your dependency tree to this file you could be experiencing an issue with your dependencies. See https://github.com/embroider-build/embroider/blob/main/docs/empty-package-output.md for more information or open an issue in the embroider repo with a recreation of your problem.',
        name: this.name,
      });
    }
  }
}
