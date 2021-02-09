import Plugin from 'broccoli-plugin';
import { Node } from 'broccoli-node-api';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { AddonMeta } from '@embroider/core';

type GetMeta = () => Partial<AddonMeta>;

export default class RewritePackageJSON extends Plugin {
  constructor(inputTree: Node, private getMeta: GetMeta, private originalPackageJSON: any) {
    super([inputTree], {
      annotation: 'embroider:core:rewrite-package-json',
    });
  }

  build() {
    let pkg = this.originalPackageJSON;
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
    pkg['ember-addon'] = meta;

    // classic addons don't get to customize their entrypoints like this. We
    // always rewrite them so their entrypoint is index.js, so whatever was here
    // is just misleading to stage3 packagers that might look (rollup does).
    delete pkg.main;
    delete pkg.module;

    writeFileSync(join(this.outputPath, 'package.json'), JSON.stringify(pkg, null, 2), 'utf8');
  }
}
