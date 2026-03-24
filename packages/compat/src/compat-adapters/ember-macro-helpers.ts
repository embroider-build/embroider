import V1Addon from '../v1-addon';

export default class extends V1Addon {
  get packageMeta() {
    let meta = super.packageMeta;
    if (!meta.externals) {
      meta.externals = [];
    }
    meta.externals.push('./-computed-store');
    return meta;
  }
}
