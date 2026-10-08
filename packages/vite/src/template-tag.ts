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
    // The object-hook filter is chosen by the vite version *we* resolve, which
    // can differ from the one actually running, so don't rely on it.
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
      // follow vite: HMR is on in dev unless the user turned it off
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
