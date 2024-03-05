import { createFilter } from '@rollup/pluginutils';
import type { Plugin } from 'vite';
import { Preprocessor } from 'content-tag';

const gjsFilter = createFilter('**/*.{gjs,gts}?(\\?)*');

export function templateTag({ inline_source_map } = { inline_source_map: false }): Plugin {
  let preprocessor = new Preprocessor();

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
