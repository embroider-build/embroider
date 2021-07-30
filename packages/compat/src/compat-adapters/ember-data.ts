import V1Addon from '../v1-addon';
import { join } from 'path';
import { Memoize } from 'typescript-memoize';
import { Node } from 'broccoli-node-api';
import { sync as resolveSync } from 'resolve';

export class EmberDataBase extends V1Addon {
  // May of the ember-data packages use rollup to try to hide their internal
  // structure. This is fragile and it breaks under embroider, and they should
  // really move this kind of "build-within-a-build" to prepublish time.
  //
  // This disables any custom implementation of `treeForAddon`. The stock
  // behavior is correct.
  customizes(...names: string[]) {
    return super.customizes(...names.filter(n => n !== 'treeForAddon'));
  }
}

export default class EmberData extends EmberDataBase {
  // ember-data needs its dynamically generated version module.
  @Memoize()
  get v2Trees() {
    let versionTree: () => Node;
    try {
      // ember-data 3.10 and earlier kept the version module here.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      versionTree = require(join(this.root, 'lib/version'));
    } catch (err) {
      handleErr(err);
      try {
        // ember-data 3.11 to 3.14 keep the version module here.
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        versionTree = require(resolveSync('@ember-data/-build-infra/src/create-version-module', {
          basedir: this.root,
        }));
      } catch (err) {
        handleErr(err);
        // ember-data 3.15+ keeps the version module here.
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        versionTree = require(resolveSync('@ember-data/private-build-infra/src/create-version-module', {
          basedir: this.root,
        }));
      }
    }

    let trees = super.v2Trees;
    trees.push(versionTree());
    return trees;
  }
}

function handleErr(err: any) {
  if (err.code !== 'MODULE_NOT_FOUND') {
    throw err;
  }
}
