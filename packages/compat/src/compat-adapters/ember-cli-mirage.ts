import V1Addon from "../v1-addon";
import { Memoize } from "typescript-memoize";
import { UnwatchedDir } from 'broccoli-source';
import Funnel from 'broccoli-funnel';

export default class EmberCLIMirage extends V1Addon {
  @Memoize()
  get v2Trees() {
    if (this.addonInstance._shouldIncludeFiles()) {
      let trees = super.v2Trees;
      trees.push(new Funnel(new UnwatchedDir(this.addonInstance.mirageDirectory), {
        destDir: '_app_/mirage'
      }));
      return trees;
    } else {
      return [];
    }
  }
}
