import V1Addon from '../v1-addon';
import buildFunnel from 'broccoli-funnel';
import type { AddonMeta } from '@embroider/core';

export default class extends V1Addon {
  get packageMeta(): Partial<AddonMeta> {
    if (this.addonInstance._shouldIncludeFiles()) {
      return super.packageMeta;
    }
    return {
      version: 2,
      'auto-upgraded': true,
    };
  }

  get v2Tree() {
    let tree = super.v2Tree;
    if (this.addonInstance._shouldIncludeFiles()) {
      return tree;
    }
    return buildFunnel(tree, {
      include: ['package.json'],
    });
  }
}
