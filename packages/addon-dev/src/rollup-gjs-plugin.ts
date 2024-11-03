import { createFilter } from '@rollup/pluginutils';
import type { Plugin } from 'rollup';
import { Preprocessor } from 'content-tag';

//@ts-ignore
import convert from 'convert-source-map';

const PLUGIN_NAME = 'rollup-gjs-plugin';

const processor = new Preprocessor();
// import { parse as pathParse } from 'path';

export default function rollupGjsPlugin(
  { inline_source_map } = { inline_source_map: true }
): Plugin {
  return {
    name: PLUGIN_NAME,

    transform: {
      // Enforce running the gjs transform before any others like babel that expect valid JS
      order: 'pre',
      handler(input: string, id: string) {
        if (!gjsFilter(id)) {
          return null;
        }
        let codeWithInlineMap = processor.process(input, {
          filename: id,
          inline_source_map,
        });

        /**
         * The true sourcemap may only be at the end of a file
         * as its own line
         */
        let lines = codeWithInlineMap.split('\n');

        // Array.prototype.at is not available (yet)
        let map = null;
        if (lines[lines.length - 1].startsWith('//# sourceMappingURL=')) {
          let mapComment = lines.pop();
          map = convert.fromComment(mapComment).toJSON();
        }

        let code = lines.join('\n');

        return {
          code,
          map,
        };
      },
    },
  };
}

const gjsFilter = createFilter('**/*.g{j,t}s');
