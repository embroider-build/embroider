import Plugin, { Tree } from 'broccoli-plugin';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { AddonMeta } from '@embroider/core';

type GetMeta = () => AddonMeta;

export default class RewritePackageJSON extends Plugin {
  constructor(inputTree: Tree, private getMeta: GetMeta) {
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
    if (!pkg['ember-addon']) {
      pkg['ember-addon'] = {};
    }
    let meta = pkg['ember-addon'] as AddonMeta;
    meta.version = 2;
    meta['auto-upgraded'] = true;
    Object.assign(meta, this.getMeta());
    this.cachedLast = pkg;
    writeFileSync(join(this.outputPath, 'package.json'), JSON.stringify(pkg, null, 2), 'utf8');
  }
}
