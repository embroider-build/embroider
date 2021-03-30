import V1Addon from '../v1-addon';
import { join } from 'path';
import { Node } from 'broccoli-node-api';
import { readdirSync, writeFileSync, readFileSync } from 'fs';
import { pathExistsSync, removeSync } from 'fs-extra';
import { Funnel } from 'broccoli-funnel';
import { transform } from '@babel/core';
import { stripBadReexportsPlugin } from '../compat-utils';

export default class extends V1Addon {
  get v2Tree(): Node {
    // workaround for https://github.com/DockYard/ember-composable-helpers/issues/308
    // and https://github.com/DockYard/ember-composable-helpers/pull/302
    // and https://github.com/DockYard/ember-composable-helpers/pull/307
    return new MatchHelpers(super.v2Tree);
  }
}

class MatchHelpers extends Funnel {
  constructor(inputTree: Node) {
    super(inputTree, {});
  }

  async build() {
    await super.build();
    let appHelpersDir = join(this.outputPath, '_app_', 'helpers');
    let addonHelpersDir = join(this.inputPaths[0], 'helpers');

    for (let filename of readdirSync(appHelpersDir)) {
      if (!pathExistsSync(join(addonHelpersDir, filename))) {
        removeSync(join(appHelpersDir, filename));
      }
    }
    let src = readFileSync(join(this.inputPaths[0], 'index.js'), 'utf8');
    let plugins = [stripBadReexportsPlugin({ resolveBase: this.outputPath })];
    writeFileSync(join(this.outputPath, 'index.js'), transform(src, { plugins })!.code!);
  }
}
