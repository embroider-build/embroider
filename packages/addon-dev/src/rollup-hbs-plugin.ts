import { createFilter } from '@rollup/pluginutils';
import type { Plugin } from 'rollup';
import { readFileSync } from 'fs';
import { hbsToJS } from '@embroider/shared-internals';

export default function rollupHbsPlugin(): Plugin {
  const filter = createFilter('**/*.hbs');

  return {
    name: 'rollup-hbs-plugin',
    load(id: string) {
      if (!filter(id)) return;
      let input = readFileSync(id, 'utf8');
      let code = hbsToJS(input);
      return {
        code,
        id: id + '.js',
      };
    },
  };
}
