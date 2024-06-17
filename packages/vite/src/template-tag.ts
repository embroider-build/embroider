import { createFilter } from '@rollup/pluginutils';
import type { Plugin } from 'vite';
import { Preprocessor } from 'content-tag';

const gjsFilter = createFilter('**/*.{gjs,gts}?(\\?)*');

export function templateTag({ inline_source_map } = { inline_source_map: false }): Plugin {
  let preprocessor = new Preprocessor();

  function candidates(id: string) {
    return [id + '.gjs', id + '.gts', id + '/index.gjs', id + '/index.gts'];
  }

  return {
    name: 'embroider-template-tag',
    enforce: 'pre',

    async resolveId(id: string, importer: string | undefined, options) {
      if (options.custom?.embroider?.isExtensionSearch) {
        return null;
      }
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
              isExtensionSearch: true,
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

    transform(code: string, id: string) {
      if (!gjsFilter(id)) {
        return null;
      }
      return preprocessor.process(code, {
        filename: id,
        inline_source_map: inline_source_map,
      });
    },
  };
}
