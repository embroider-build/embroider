import V1Addon from '../v1-addon';
import { join, dirname } from 'path';
import { UnwatchedDir } from 'broccoli-source';
import resolve from 'resolve';
import { Memoize } from 'typescript-memoize';
import buildFunnel from 'broccoli-funnel';
import semver from 'semver';

export default class extends V1Addon {
  // v2.0.0 removes the usage of `ember-debug-handlers-polyfill`, so we only need to apply the adapter if we're working
  // with a version that is older than that
  static shouldApplyAdapter(addonInstance: any) {
    return semver.lt(addonInstance.pkg.version, '2.0.0');
  }

  @Memoize()
  get v2Trees() {
    // ember-cli-deprecation-workflow does `app.import` of a file that isn't in
    // its own vendor tree, the file is in ember-debug-handlers-polyfill's
    // vendor tree. It presumably does this because (1) it fails to call super
    // in `included()`, so the ember-debug-handlers-polyfill won't be able to do
    // its own app.import, and (2) even if you fix that,
    // ember-debug-handlers-polyfill itself has a bug that makes it not work as
    // a second-level addon.
    let polyfillDir = dirname(
      resolve.sync('ember-debug-handlers-polyfill/package.json', { basedir: this.addonInstance.root })
    );
    let tree = buildFunnel(new UnwatchedDir(join(polyfillDir, 'vendor')), {
      destDir: 'vendor',
    });
    let trees = super.v2Trees;
    trees.push(tree);
    return trees;
  }
}
