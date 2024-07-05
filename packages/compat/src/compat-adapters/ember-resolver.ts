import V1Addon from '../v1-addon';

export default class extends V1Addon {
  get packageMeta() {
    let meta = super.packageMeta;
    if (meta['implicit-modules']) {
      // ember-resolver has a vestigial empty file here that existed due to
      // babel-plugin-debug-macros behavior. But ember-resolver no longer uses
      // babel-plugin-debug-macros. And the empty file makes vite's CJS interop
      // get confused and produce a runtime crash.
      meta['implicit-modules'] = meta['implicit-modules'].filter(m => m !== './features');
    }
    return meta;
  }
}
