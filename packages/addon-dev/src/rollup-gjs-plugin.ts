import { createFilter } from '@rollup/pluginutils';
import type { Plugin } from 'rollup';
import { Preprocessor } from 'content-tag';

const PLUGIN_NAME = 'rollup-gjs-plugin';

const processor = new Preprocessor();
// import { parse as pathParse } from 'path';

export default function rollupGjsPlugin(): Plugin {
  return {
    name: PLUGIN_NAME,

    transform: {
      // Enforce running the gjs transform before any others like babel that expect valid JS
      order: 'pre',
      handler(input: string, id: string) {
        if (!gjsFilter(id)) {
          return null;
        }
        let { code, map } = processor.process(input, {
          filename: id,
        });
        return {
          code,
          map,
        };
      },
    },
  };
}

const gjsFilter = createFilter('**/*.g{j,t}s');
