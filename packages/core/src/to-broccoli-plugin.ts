import Plugin from "broccoli-plugin";
import { Packager, PackagerInstance } from "./packager";
import { Memoize } from "typescript-memoize";
import App from "./app";

interface BroccoliPackager<Options> {
  new(app: App, options?: Options): Plugin;
}

export default function toBroccoliPlugin<Options>(packagerClass: Packager<Options>): BroccoliPackager<Options> {
  class PackagerRunner extends Plugin {
    constructor(private app: App, private options?: Options) {
      super([app.tree], {
        persistentOutput: true,
        needsCache: false
      });
    }

    @Memoize()
    private get packager(): PackagerInstance {
      return new packagerClass(
        this.app.root,
        this.outputPath,
        (msg) => console.log(msg),
        this.options,
      );
    }

    build() {
      return this.packager.build();
    }
  }
  return PackagerRunner;
}
