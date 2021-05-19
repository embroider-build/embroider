import V1Addon from '../v1-addon';
import buildFunnel from 'broccoli-funnel';
import cloneDeep from 'lodash/cloneDeep';

// ember-asset-loader's ManifestGenerator (which is used as the Addon base class
// for by ember-engines) has an "all" postprocessTree hook. We can't / won't run
// those in embroider. The hook inserts the asset manifest into index.html.
//
// This patch removes the code that would explode if it tries to read from that
// manifest. ember-asset-loader itself has a mode that excludes these files, so
// it's tolerant of them being missing.
//
// We mostly just want ember-asset-loader to sit down and be quiet, because lazy
// loading is a thing that is natively handled by embroider.
export default class extends V1Addon {
  get v2Tree() {
    return buildFunnel(super.v2Tree, {
      exclude: ['_app_/config/asset-manifest.js', '_app_/instance-initializers/load-asset-manifest.js'],
    });
  }
  get packageMeta() {
    let meta = super.packageMeta;
    if (meta['app-js']) {
      meta = cloneDeep(meta);
      delete meta['app-js']!['./instance-initializers/load-asset-manifest.js'];
      delete meta['app-js']!['./config/asset-manifest.js'];
    }
    return meta;
  }
}
