import { Node } from 'broccoli-node-api';
import { Funnel } from 'broccoli-funnel';

export default class ObserveTree extends Funnel {
  constructor(combinedVendor: Node, private hook: (outputPath: string) => Promise<void> | void) {
    super(combinedVendor, {
      annotation: '@embroider/compat/observe-tree',
    });
  }
  async build() {
    await super.build();
    await this.hook(this.outputPath);
  }
}
