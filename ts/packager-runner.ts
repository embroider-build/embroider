import Plugin from "broccoli-plugin";
import { Packager, PackagerInstance } from "./packager";
import { Memoize } from "typescript-memoize";
import App from "./app";

export default class PackagerRunner extends Plugin {
  constructor(private packagerClass: Packager, private app: App) {
    super([app.vanillaTree], {
      persistentOutput: true,
      needsCache: false
    });
  }

  @Memoize()
  private get packager(): PackagerInstance {
    return new this.packagerClass(this.app.root, this.outputPath, {
      consoleWrite: (msg) => console.log(msg)
    });
  }

  build() {
    return this.packager.build();
  }
}
