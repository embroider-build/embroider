import { Tree } from 'broccoli-plugin';
import Funnel from 'broccoli-funnel';

export default class ObserveTree extends Funnel {
  constructor(combinedVendor: Tree, private hook: (outputPath: string) => Promise<void> | void) {
    super(combinedVendor, {
      annotation: '@embroider/compat/observe-tree',
    });
  }
  async build() {
    await super.build();
    await this.hook(this.outputPath);
  }
}
