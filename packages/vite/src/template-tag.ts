import type { Plugin } from 'vite';
import { Preprocessor } from 'content-tag';
import { extFilter, supportsObjectHooks } from './build-id-filter.js';
import { hotTransform, shouldHotTransform } from './hmr.js';

export const gjsFilter = extFilter('gjs', 'gts');

export function templateTag(): Plugin {
  let preprocessor = new Preprocessor();
  let hot = false;
  let root = '';

  function transform(code: string, id: string, options?: { ssr?: boolean }) {
    /**
     * Whether we use the object-hook filter depends on the vite version this package resolves,
     * which can differ from the vite that is running.
     * Vite 5 ignores the filter, so this check keeps .js files out.
     */
    if (!gjsFilter.test(id)) {
      return null;
    }
    if (hot && !options?.ssr && shouldHotTransform(id, root)) {
      return hotTransform(preprocessor, code, id);
    }
    return preprocessor.process(code, {
      filename: id,
    });
  }

  return {
    name: 'embroider-template-tag',
    enforce: 'pre',

    configResolved(config) {
      /**
       * HMR follows vite's own setting instead of adding an Embroider option,
       * so apps don't need config to get it or to turn it off.
       */
      hot = config.command === 'serve' && config.server.hmr !== false;
      root = config.root;
    },

    transform: supportsObjectHooks
      ? {
          filter: { id: gjsFilter },
          handler(code: string, id: string, options?: { ssr?: boolean }) {
            return transform(code, id, options);
          },
        }
      : transform,
  };
}
