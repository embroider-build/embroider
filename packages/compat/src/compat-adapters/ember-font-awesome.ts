import V1Addon from '../v1-addon';
import { AddonMeta } from '@embroider/core';
import walkSync from 'walk-sync';

export default class EmberFontAwesome extends V1Addon {
  get packageMeta(): Partial<AddonMeta> {
    let meta = super.packageMeta;
    if (!meta['public-assets']) {
      meta['public-assets'] = {};
    }
    let fontFiles = walkSync('node_modules/font-awesome/fonts/');
    for (let path of fontFiles) {
      let [fileName] = path.split('/').reverse();
      meta['public-assets'][path] = `/fonts/${fileName}`;
    }
    return meta;
  }
}
