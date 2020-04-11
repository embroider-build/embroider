import Plugin, { Tree } from 'broccoli-plugin';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { AddonMeta, Package } from '@embroider/core';

type GetMeta = () => Partial<AddonMeta>;
type GetNonResolvableDependencies = () => Package[];

export default class RewritePackageJSON extends Plugin {
  constructor(
    inputTree: Tree,
    private getMeta: GetMeta,
    private getNonResolvableDependencies: GetNonResolvableDependencies
  ) {
    super([inputTree], {
      annotation: 'embroider:core:rewrite-package-json',
    });
  }

  private cachedLast: { 'ember-addon': AddonMeta } | undefined;

  get lastPackageJSON() {
    if (!this.cachedLast) {
      throw new Error(`tried to access package.json contents for a package that hasn't been build yet`);
    }
    return this.cachedLast;
  }

  build() {
    let pkg = JSON.parse(readFileSync(join(this.inputPaths[0], 'package.json'), 'utf8'));
    let meta: AddonMeta = Object.assign(
      {},
      pkg.meta,
      {
        version: 2,
        'auto-upgraded': true,
        type: 'addon',
      } as AddonMeta,
      this.getMeta()
    );
    this.cachedLast = pkg;
    pkg['ember-addon'] = meta;

    let nonResolvableDependencies = this.getNonResolvableDependencies();
    if (nonResolvableDependencies.length && !pkg.dependencies) {
      pkg.dependencies = {};
    }

    for (let dep of nonResolvableDependencies) {
      pkg.dependencies[dep.name] = '*';
    }

    writeFileSync(join(this.outputPath, 'package.json'), JSON.stringify(pkg, null, 2), 'utf8');
  }
}
