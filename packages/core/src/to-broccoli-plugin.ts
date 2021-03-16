import Plugin from 'broccoli-plugin';
import { Packager, PackagerInstance, Variant, FingerprintOptions } from './packager';
import Stage from './stage';

interface BroccoliPackager<Options> {
  new (stage: Stage, variants: Variant[], fingerprint: FingerprintOptions, options?: Options): Plugin;
}

export default function toBroccoliPlugin<Options>(packagerClass: Packager<Options>): BroccoliPackager<Options> {
  class PackagerRunner extends Plugin {
    private packager: PackagerInstance | undefined;
    constructor(
      private stage: Stage,
      private variants: Variant[],
      private fingerprintOptions: FingerprintOptions,
      private options?: Options
    ) {
      super([stage.tree], {
        persistentOutput: true,
        needsCache: false,
        annotation: packagerClass.annotation,
      });
    }

    async build() {
      if (!this.packager) {
        let { outputPath, packageCache } = await this.stage.ready();
        // We always register a shared stage3 packageCache so it can be used by
        // things like babel plugins and template compilers.
        if (packageCache) {
          packageCache.shareAs('embroider-stage3');
        }
        this.packager = new packagerClass(
          outputPath,
          this.outputPath,
          this.variants,
          msg => console.log(msg),
          this.fingerprintOptions,
          this.options
        );
      }
      return this.packager.build();
    }
  }
  return PackagerRunner;
}
