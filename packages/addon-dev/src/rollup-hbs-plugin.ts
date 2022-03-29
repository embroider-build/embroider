import { createFilter } from '@rollup/pluginutils';
import type { Plugin } from 'rollup';
import { readFileSync } from 'fs';
const backtick = '`';

export default function rollupHbsPlugin(): Plugin {
  const templateFilter = createFilter('**/*.hbs');
  const moduleFilter = createFilter('**/*.hbs.js');

  return {
    name: 'rollup-hbs-plugin',
    async resolveId(source: string, importer: string | undefined, options) {
      const resolution = await this.resolve(source, importer, {
        skipSelf: true,
        ...options,
      });

      const id = resolution?.id;

      if (!templateFilter(id)) return null;

      // This creates an `*.hbs.js` that we will populate in `load()` hook.
      return {
        ...resolution,
        id: id + '.js',
        meta: {
          'rollup-hbs-plugin': {
            originalId: id,
          },
        },
      };
    },
    load(id: string) {
      if (!moduleFilter(id)) return null;

      const meta = this.getModuleInfo(id)?.meta;
      const originalId = meta?.['rollup-hbs-plugin']?.originalId;

      if (!originalId) {
        return;
      }

      let input = readFileSync(originalId, 'utf8');
      let code =
        `import { hbs } from 'ember-cli-htmlbars';\n` +
        `export default hbs${backtick}${input}${backtick};`;
      return {
        code,
      };
    },
  };
}
