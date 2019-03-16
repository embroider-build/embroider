import Plugin from "broccoli-plugin";
import { Packager, PackagerInstance } from "./packager";
import Stage from "./stage";
import PackageCache from "./package-cache";

interface BroccoliPackager<Options> {
  new(stage: Stage, options?: Options): Plugin;
}

export default function toBroccoliPlugin<Options>(packagerClass: Packager<Options>): BroccoliPackager<Options> {
  class PackagerRunner extends Plugin {
    private packager: PackagerInstance | undefined;
    constructor(private stage: Stage, private options?: Options) {
      super([stage.tree], {
        persistentOutput: true,
        needsCache: false,
        annotation: packagerClass.annotation
      });
    }

    async build() {
      if (!this.packager) {
        let { outputPath, packageCache } = await this.stage.ready();
        // stages are allowed to share a package cache as an optimization, but
        // they aren't required to. Whereas Packagers are allowed to assume they
        // will receive a packageCache instance.
        //
        // We also always register a shared stage3 packageCache so it can be
        // used by things like babel plugins and template compilers.
        if (packageCache) {
          packageCache.shareAs('embroider-stage3');
        } else {
          packageCache = PackageCache.shared('embroider-stage3');
        }
        this.packager = new packagerClass(
          outputPath,
          this.outputPath,
          (msg) => console.log(msg),
          packageCache,
          this.options,
        );
      }
      return this.packager.build();
    }
  }
  return PackagerRunner;
}
