import { createFilter } from '@rollup/pluginutils';
import type { Plugin } from 'vite';
import { readFileSync } from 'fs';
import { Preprocessor } from 'content-tag';

const gjsFilter = createFilter('**/*.{gjs,gts}?(\\?)*');

export function templateTag(): Plugin {
  let preprocessor = new Preprocessor();

  function candidates(id: string) {
    if (id.endsWith('.gjs')) return id;
    if (id.endsWith('.gts')) return id;
    return [id + '.gjs', id + '.gts'];
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
      id = id.replace(/\.gjs\?.*/, '.gjs');
      id = id.replace(/\.gts\?.*/, '.gts');
      return preprocessor.process(readFileSync(id, 'utf8'), id);
    },
  };
}
