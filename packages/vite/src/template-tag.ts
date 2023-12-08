import { createFilter } from '@rollup/pluginutils';
import type { Plugin } from 'vite';
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
      // prevent resolve loop during vite build
      if (id.endsWith('.gts')) return null;
      if (id.endsWith('.gjs')) return null;
      let resolution;
      try {
        resolution = await this.resolve(id, importer, {
          skipSelf: true,
        });
      } catch (e) {
        return null;
      }
      if (resolution) {
        return resolution;
      }
      for (let candidate of candidates(id)) {
        try {
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
        } catch (e) {
          return null;
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
