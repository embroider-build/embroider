import Plugin from 'broccoli-plugin';
import { Node } from 'broccoli-node-api';
import { Builder } from 'broccoli';
import { copySync } from 'fs-extra';
import heimdall from 'heimdalljs';

class NerfHeimdallBuilder extends Builder {
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
  constructor(private inner: Node | null, private addonName: string) {
    // from broccoli's perspective, we don't depend on any input trees!
    super([], {
      annotation: `@embroider/compat: ${addonName}`,
      persistentOutput: true,
      needsCache: false,
    });
  }

  async build() {
    const { inner } = this;
    if (inner === null) return;
    this.inner = null;

    await suppressNestedHeimdall(`OneShot(${this.addonName})`, async () => {
      const builder = new NerfHeimdallBuilder(inner);
      try {
        await builder.build();
        copySync(builder.outputPath, this.outputPath, { dereference: true });
      } finally {
        await builder.cleanup();
      }
    });
  }
}

async function suppressNestedHeimdall(name: string, using: () => Promise<void>): Promise<void> {
  // Make a heimdall node so that we know for sure, all nodes created during our
  // inner builder can be remove easily
  const token = heimdall.start({ name });
  const node = heimdall.current;
  try {
    await using();
  } finally {
    token.stop();
    node.remove();
  }
}
