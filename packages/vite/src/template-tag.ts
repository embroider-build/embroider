import { createFilter } from '@rollup/pluginutils';
import type { Plugin } from 'vite';
import { readFileSync } from 'fs';
import { Preprocessor } from 'content-tag';

const gjsFilter = createFilter('**/*.gjs');

export function templateTag(): Plugin {
  let preprocessor = new Preprocessor();

  function candidates(id: string) {
    return [id + '.gjs'];
  }

  return {
    name: 'embroider-template-tag',
    enforce: 'pre',

    async resolveId(id: string, importer: string | undefined) {
      let resolution = await this.resolve(id, importer, {
        skipSelf: true,
      });
      if (resolution) {
        return resolution;
      }
      for (let candidate of candidates(id)) {
        resolution = await this.resolve(candidate, importer, {
          skipSelf: true,
          custom: {
            embroider: {
              enableCustomResolver: false,
            },
          },
        });
        if (resolution) {
          return {
            id: resolution.id,
          };
        }
      }
    },

    load(id: string) {
      if (!gjsFilter(id)) {
        return null;
      }
      return preprocessor.process(readFileSync(id, 'utf8'), id);
    },
  };
}
