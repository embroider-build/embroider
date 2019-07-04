import V1Addon from '../v1-addon';
import { AddonMeta } from '@embroider/core';

export default class EmberFontAwesome extends V1Addon {
  get packageMeta(): Partial<AddonMeta> {
    let meta = super.packageMeta || {};
    meta['public-assets'] = {
      'node_modules/font-awesome/fonts/FontAwesome.otf': '/fonts/FontAwesome.otf',
    };
    for (let extension of ['eot', 'svg', 'ttf', 'woff', 'woff2']) {
      let fileName = `fontawesome-webfont.${extension}`;
      meta['public-assets'][`node_modules/font-awesome/fonts/${fileName}`] = `/fonts/${fileName}`;
    }
    return meta;
  }
}
