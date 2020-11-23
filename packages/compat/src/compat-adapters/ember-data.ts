import V1Addon from '../v1-addon';
import { join } from 'path';
import { Memoize } from 'typescript-memoize';
import cloneDeep from 'lodash/cloneDeep';
import { AddonMeta } from '@embroider/core';
import { Node } from 'broccoli-node-api';
import { sync as resolveSync } from 'resolve';

export default class EmberData extends V1Addon {
  // ember-data customizes the addon tree, but we don't want to run that one
  // because it breaks when we try to eliminate absolute self-imports. We'll
  // take the stock behavior instead.
  customizes(...names: string[]) {
    return super.customizes(...names.filter(n => n !== 'treeForAddon'));
  }

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

  // this is enough to make sure we drop the debug code in prod. This only
  // matters when the app is running with staticAddonTrees=false, otherwise this
  // kind of optimization is automatic.
  get packageMeta(): Partial<AddonMeta> {
    let meta = super.packageMeta;
    if (isProductionEnv() && !isInstrumentedBuild()) {
      meta = cloneDeep(meta);
      if (meta['implicit-modules']) {
        meta['implicit-modules'] = meta['implicit-modules'].filter(name => !name.startsWith('./-debug/'));
      }
    }
    return meta;
  }
}

function isProductionEnv() {
  let isProd = /production/.test(process.env.EMBER_ENV!);
  let isTest = process.env.EMBER_CLI_TEST_COMMAND;
  return isProd && !isTest;
}

function isInstrumentedBuild() {
  return process.argv.includes('--instrument');
}

function handleErr(err: any) {
  if (err.code !== 'MODULE_NOT_FOUND') {
    throw err;
  }
}
