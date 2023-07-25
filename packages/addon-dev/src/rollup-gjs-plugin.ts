import { createFilter } from '@rollup/pluginutils';
import type { Plugin } from 'rollup';
import { readFileSync } from 'fs';
import { Preprocessor } from 'content-tag';

const PLUGIN_NAME = 'rollup-gjs-plugin';

const processor = new Preprocessor();
// import { parse as pathParse } from 'path';

export default function rollupGjsPlugin(): Plugin {
  return {
    name: PLUGIN_NAME,

    load(id: string) {
      if (!gjsFilter(id)) {
        return null;
      }
      let input = readFileSync(id, 'utf8');
      let code = processor.process(input, id);
      return {
        code,
      };
    },
  };
}

const gjsFilter = createFilter('**/*.g{j,t}s');
