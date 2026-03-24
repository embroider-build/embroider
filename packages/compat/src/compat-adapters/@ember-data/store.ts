import type { AddonMeta } from '@embroider/core';
import { EmberDataBase } from '../ember-data';

export default class EmberDataStore extends EmberDataBase {
  get packageMeta(): Partial<AddonMeta> {
    let meta = super.packageMeta;

    // this is here because the compat-adapter for @ember-data/debug adds this
    // to externals because it has an undeclared peerDep on us, and thus might
    // resolve totally incorrect copies. By making it external we leave it up to
    // runtime, where we will find this implicit-module for the actual copy of
    // @ember-data/store that is active in app.
    meta['implicit-modules'] = [...(meta['implicit-modules'] ?? []), './index.js'];

    return meta;
  }
}
