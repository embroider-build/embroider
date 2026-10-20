import type { Plugin } from 'vite';

/**
 * @deprecated This plugin no longer does anything. The classic vendor and
 * test-support scripts are now served from `@embroider/virtual` and are
 * fingerprinted as part of the regular build. You can remove `scripts()` from
 * your vite config.
 */
export function scripts(_params?: { include?: string[]; exclude?: string[] }): Plugin {
  return {
    name: 'embroider-scripts',

    configResolved() {
      console.warn(
        `The scripts() plugin from @embroider/vite is deprecated and no longer does anything. You can remove it from your vite config.`
      );
    },
  };
}
