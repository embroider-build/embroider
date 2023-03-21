import Plugin from 'broccoli-plugin';
import { Packager, PackagerConstructor, Variant } from './packager';
import { tmpdir } from '@embroider/shared-internals';
import type { Node } from 'broccoli-node-api';

interface BroccoliPackager<Options> {
  new (stage: Node, appRoot: string, variants: Variant[], options?: Options): Plugin;
}

export default function toBroccoliPlugin<Options>(
  packagerClass: PackagerConstructor<Options>
): BroccoliPackager<Options> {
  class PackagerRunner extends Plugin {
    private packager: Packager | undefined;
    constructor(stage: Node, private appRoot: string, private variants: Variant[], private options?: Options) {
      super([stage], {
        persistentOutput: true,
        needsCache: false,
        annotation: packagerClass.annotation,
      });
    }

    async build() {
      if (!this.packager) {
        this.packager = new packagerClass(
          this.appRoot,
          this.outputPath,
          this.variants,
          msg => console.log(msg.split(tmpdir).join('$TMPDIR')),
          this.options
        );
      }
      return this.packager.build();
    }
  }
  return PackagerRunner;
}
