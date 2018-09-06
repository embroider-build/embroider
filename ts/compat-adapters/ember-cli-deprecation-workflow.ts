import V1Addon from "../v1-addon";
import { join, dirname } from 'path';
import { UnwatchedDir } from 'broccoli-source';
import resolve from 'resolve';
import { Memoize } from "typescript-memoize";
import Funnel from 'broccoli-funnel';

export default class EmberData extends V1Addon {
  @Memoize()
  get v2Trees() {
    // ember-cli-deprecation-workflow does `app.import` of a file that isn't in
    // its own vendor tree, the file is in ember-debug-handlers-polyfill's
    // vendor tree. It presumably does this because (1) it fails to call super
    // in `included()`, so the ember-debug-handlers-polyfill won't be able to do
    // its own app.import, and (2) even if you fix that,
    // ember-debug-handlers-polyfill itself has a bug that makes it not work as
    // a second-level addon.
    let polyfillDir = dirname(resolve.sync('ember-debug-handlers-polyfill/package.json', { basedir: this.addonInstance.root }));
    let tree = new Funnel(new UnwatchedDir(join(polyfillDir, 'vendor')), {
      destDir: 'vendor'
    });
    let trees = super.v2Trees;
    trees.push(tree);
    return trees;
  }
}
