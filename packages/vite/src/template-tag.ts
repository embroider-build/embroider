import type { Plugin } from 'vite';
import { Preprocessor } from 'content-tag';
import { buildIdFilter } from './build-id-filter.js';

export const gjsFilter = buildIdFilter({ extensions: ['gjs', 'gts'] });

export function templateTag(): Plugin {
  let preprocessor = new Preprocessor();

  return {
    name: 'embroider-template-tag',
    enforce: 'pre',

    transform: {
      filter: gjsFilter,
      handler(code: string, id: string) {
        return preprocessor.process(code, {
          filename: id,
        });
      },
    },
  };
}
