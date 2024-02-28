import { createFilter } from '@rollup/pluginutils';
import type { Plugin } from 'rollup';
import { readFileSync } from 'fs';
import { Preprocessor } from 'content-tag';

const PLUGIN_NAME = 'rollup-gjs-plugin';

const processor = new Preprocessor();
// import { parse as pathParse } from 'path';

export default function rollupGjsPlugin(
  { inline_source_map } = { inline_source_map: true }
): Plugin {
  return {
    name: PLUGIN_NAME,

    load(id: string) {
      if (!gjsFilter(id)) {
        return null;
      }
      let input = readFileSync(id, 'utf8');
      let code = processor.process(input, {
        filename: id,
        inline_source_map,
      });
      return {
        code,
      };
    },
  };
}

const gjsFilter = createFilter('**/*.g{j,t}s');
