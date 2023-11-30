import V1Addon from '../v1-addon';
import type { AddonMeta } from '@embroider/core';

export default class extends V1Addon {
  get packageMeta(): Partial<AddonMeta> {
    let meta = super.packageMeta;

    // this file is not accessible from the outside of ember-fetch and is not being used inside ember-fetch so it's dead code
    // but it is importing `@ember/polyfills` which casues ember-source@5 to crash because it has been removed
    if (meta['implicit-modules']) {
      meta['implicit-modules'] = meta['implicit-modules'].filter(mod => mod !== './utils/mung-options-for-fetch');
    }

    return meta;
  }
}
