import { Tree } from "broccoli-plugin";
import Funnel from "broccoli-funnel";

export default class AddToTree extends Funnel {
  constructor(combinedVendor: Tree, private hook: (outputPath: string) => Promise<void> | void) {
    super(combinedVendor, {
      annotation: '@embroider/compat/synthvendor'
    });
  }
  async build() {
    await super.build();
    await this.hook(this.outputPath);
   }
}
