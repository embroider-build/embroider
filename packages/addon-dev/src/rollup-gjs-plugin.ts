import { createFilter } from '@rollup/pluginutils';
import type { LogLevel, Plugin, RollupLog } from 'rollup';
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

    onLog(_level: LogLevel, log: RollupLog): boolean | void {
      if (log.code === 'EVAL' && gjsFilter(log.id)) {
        return false;
      }
    },
  };
}

const gjsFilter = createFilter('**/*.g{j,t}s');
