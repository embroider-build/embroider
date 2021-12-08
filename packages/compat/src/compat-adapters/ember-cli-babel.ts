import V1Addon from '../v1-addon';

export default class EmberCliBabel extends V1Addon {
  // the only copy of ember-cli-babel that might need to do something is the
  // first one that wants to emit babel polyfills. No other copy is allowed to
  // emit anything into the build.
  reduceInstances(copies: EmberCliBabel[]): EmberCliBabel[] {
    let polyfillCopy = copies.find(c => {
      let instance = c.addonInstance as any;
      return typeof instance._shouldIncludePolyfill === 'function' && instance._shouldIncludePolyfill();
    });
    if (polyfillCopy) {
      return [polyfillCopy];
    } else {
      return [];
    }
  }
}
