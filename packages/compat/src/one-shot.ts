import Plugin from 'broccoli-plugin';
import { Node } from 'broccoli-node-api';
import { Builder } from 'broccoli';
import { copySync } from 'fs-extra';
import heimdall from 'heimdalljs';

class NerfHeimdallReparentingBuilder extends Builder {
  /*
    Replace the code used to track heimdall nodes: https://github.com/broccolijs/broccoli/blob/v3.5.2/lib/builder.ts#L463-L503

    This reduces the amount of memory that these one-shot's create by:

    - Avoiding creating Heimdall nodes for each broccoli plugin
    - Disabling the "re-parenting" process done by Broccoli builder (which ends up creating **double** the heimdall nodes)
  */
  setupHeimdall() {}
  buildHeimdallTree() {}
}

// Wraps a broccoli tree such that it (and everything it depends on) will only
// build a single time.
export default class OneShot extends Plugin {
  private builder: NerfHeimdallReparentingBuilder | null;

  constructor(originalTree: Node, private addonName: string) {
    // from broccoli's perspective, we don't depend on any input trees!
    super([], {
      annotation: `@embroider/compat: ${addonName}`,
      persistentOutput: true,
    });

    // create a nested builder in order to isolate the specific addon
    this.builder = new NerfHeimdallReparentingBuilder(originalTree);
  }

  async build() {
    const { builder } = this;

    // only build the first time
    if (builder === null) {
      return;
    }
    this.builder = null;

    // Make a heimdall node so that we know for sure, all nodes created during our
    // inner builder can be remove easily
    const oneshotCookie = heimdall.start({
      name: `@embroider/compat: OneShot (${this.addonName})`,
    });
    const oneshotHeimdallNode = heimdall.current;

    try {
      await builder.build();
      copySync(builder.outputPath, this.outputPath, { dereference: true });
      await builder.cleanup();
    } finally {
      oneshotCookie.stop();
      /*
        Remove any of the current node's direct children, this ensures that we do not bloat the
        current Broccoli builder's heimdall node graph (e.g. the one that is calling
        OneShotPlugin; **not** the one that the OneShotPlugin internally creates).
      */
      oneshotHeimdallNode.remove();
    }
  }
}
