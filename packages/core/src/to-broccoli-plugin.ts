import Plugin from "broccoli-plugin";
import { Packager, PackagerInstance } from "./packager";
import App from "./app";

interface BroccoliPackager<Options> {
  new(app: App, options?: Options): Plugin;
}

export default function toBroccoliPlugin<Options>(packagerClass: Packager<Options>): BroccoliPackager<Options> {
  class PackagerRunner extends Plugin {
    private packager: PackagerInstance | undefined;
    constructor(private app: App, private options?: Options) {
      super([app.tree], {
        persistentOutput: true,
        needsCache: false
      });
    }

    async build() {
      if (!this.packager) {
        let { root } = await this.app.ready();
        this.packager = new packagerClass(
          root,
          this.outputPath,
          (msg) => console.log(msg),
          this.options,
        );
      }
      return this.packager.build();
    }
  }
  return PackagerRunner;
}
