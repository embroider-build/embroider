import V1Addon from '../../v1-addon';

export default class EmberDataModel extends V1Addon {
  get packageMeta() {
    const meta = super.packageMeta;
    if (!meta['implicit-modules']) {
      meta['implicit-modules'] = [];
    }
    meta['implicit-modules'].push('./-private');
    return meta;
  }
}
