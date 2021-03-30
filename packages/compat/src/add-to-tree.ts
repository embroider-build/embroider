import { Node } from 'broccoli-node-api';
import { Funnel } from 'broccoli-funnel';

export default class AddToTree extends Funnel {
  constructor(combinedVendor: Node, private hook: (outputPath: string) => Promise<void> | void) {
    super(combinedVendor, {
      annotation: '@embroider/compat/synthvendor',
    });
  }
  shouldLinkRoots() {
    // We want to force funnel to copy things rather than just linking the whole
    // directory, because we're planning to mutate it.
    return false;
  }
  async build() {
    await super.build();
    await this.hook(this.outputPath);
  }
}
