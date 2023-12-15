import { createFilter } from '@rollup/pluginutils';
import type { Plugin } from 'vite';
import { Preprocessor } from 'content-tag';

const gjsFilter = createFilter('**/*.{gjs,gts}?(\\?)*');

export function templateTag(): Plugin {
  let preprocessor = new Preprocessor();

  function candidates(id: string) {
    return [id + '.gjs', id + '.gts'];
  }

  return {
    name: 'embroider-template-tag',
    enforce: 'pre',

    async resolveId(id: string, importer: string | undefined, options) {
      if (options.custom?.onlyResolver || options.custom?.embroider?.enableCustomResolver === false) {
        return null;
      }
      let resolution = await this.resolve(id, importer, {
        skipSelf: true,
        custom: {
          ...options.custom,
          onlyResolver: true,
          embroider: {
            meta: options.custom?.embroider?.meta,
          },
        },
      });
      if (resolution) {
        return resolution;
      }
      for (let candidate of candidates(id)) {
        resolution = await this.resolve(candidate, importer, {
          skipSelf: true,
          custom: {
            ...options.custom,
            onlyResolver: true,
            embroider: {
              enableCustomResolver: false,
              meta: options.custom?.embroider?.meta,
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
      return preprocessor.process(code, id);
    },
  };
}
