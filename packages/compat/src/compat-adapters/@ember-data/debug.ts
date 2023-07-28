import { AddonMeta } from '@embroider/core';
import V1Addon from '../../v1-addon';
import semver from 'semver';

export default class EmberDataDebug extends V1Addon {
  get packageMeta(): Partial<AddonMeta> {
    let meta = super.packageMeta;

    // See also the compat-adapter for @ember-data/store where we make this an
    // implicit-module.
    meta.externals = [...(meta.externals ?? []), '@ember-data/store'];

    return meta;
  }

  static shouldApplyAdapter(addonInstance: any) {
    return semver.lt(addonInstance.pkg.version, '4.11.1');
  }
}
