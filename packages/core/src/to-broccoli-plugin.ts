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
        needsCache: false
      });
    }

    async build() {
      if (!this.packager) {
        let { outputPath, packageCache } = await this.stage.ready();
        if (!packageCache) {
          // stages are allowed to share a package cache as an optimization, but
          // they aren't required to. Whereas Packages are allowed to assume
          // they will receive a packageCache instance.
          packageCache = new PackageCache();
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
