import Plugin from 'broccoli-plugin';
import type { Packager, PackagerConstructor, Variant } from './packager';
import type Stage from './stage';
import { tmpdir } from '@embroider/shared-internals';

interface BroccoliPackager<Options> {
  new (stage: Stage, variants: Variant[], options?: Options): Plugin;
}

export default function toBroccoliPlugin<Options>(
  packagerClass: PackagerConstructor<Options>
): BroccoliPackager<Options> {
  class PackagerRunner extends Plugin {
    private packager: Packager | undefined;
    constructor(private stage: Stage, private variants: Variant[], private options?: Options) {
      super([stage.tree], {
        persistentOutput: true,
        needsCache: false,
        annotation: packagerClass.annotation,
      });
    }

    async build() {
      if (!this.packager) {
        this.packager = new packagerClass(
          this.stage.inputPath,
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
