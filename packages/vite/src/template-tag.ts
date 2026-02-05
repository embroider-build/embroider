import { makeIdFiltersToMatchWithQuery } from '@rolldown/pluginutils';
import type { Plugin } from 'vite';
import { Preprocessor } from 'content-tag';

const gjsFilter = makeIdFiltersToMatchWithQuery('**/*.{gjs,gts}');

export function templateTag(): Plugin {
  let preprocessor = new Preprocessor();

  return {
    name: 'embroider-template-tag',
    enforce: 'pre',

    transform: {
      filter: {
        id: gjsFilter,
      },
      handler(code: string, id: string) {
        return preprocessor.process(code, {
          filename: id,
        });
      },
    },
  };
}
