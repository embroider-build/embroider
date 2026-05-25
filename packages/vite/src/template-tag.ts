import type { Plugin } from 'vite';
import { Preprocessor } from 'content-tag';
import { extFilter, supportsObjectHooks } from './build-id-filter.js';

export const gjsFilter = extFilter('gjs', 'gts');

export function templateTag(): Plugin {
  let preprocessor = new Preprocessor();

  return {
    name: 'embroider-template-tag',
    enforce: 'pre',

    transform: supportsObjectHooks
      ? {
          filter: { id: gjsFilter },
          handler(code: string, id: string) {
            return preprocessor.process(code, {
              filename: id,
            });
          },
        }
      : function (code: string, id: string) {
          if (!gjsFilter.test(id)) return null;
          return preprocessor.process(code, {
            filename: id,
          });
        },
  };
}
