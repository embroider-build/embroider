import V1Addon from "../v1-addon";
import Funnel from "broccoli-funnel";

export default class extends V1Addon {
  get packageMeta() {
    if (this.addonInstance._shouldIncludeFiles()) {
      return super.packageMeta;
    }
    return {
      version: 2 as 2,
      'auto-upgraded': true as true,
    };
  }

  get v2Tree() {
    let tree = super.v2Tree;
    if (this.addonInstance._shouldIncludeFiles()) {
      return tree;
    }
    return new Funnel(tree, {
      include: ['package.json']
    });
  }
}
