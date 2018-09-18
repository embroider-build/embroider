import V1Addon from "../v1-addon";
import { join } from 'path';
import { Memoize } from "typescript-memoize";

export default class EmberData extends V1Addon {
  @Memoize()
  get v2Trees() {
    let version = require(join(this.root, 'lib/version'));
    let trees = super.v2Trees;
    trees.push(version());
    return trees;
  }

  // ember-data customizes the addon tree, but we don't want to run that one.
  // We'll take the stock behavior instead.
  customizes(...names) {
    return super.customizes(...names.filter(n => n !== 'treeForAddon'));
  }
}
