import { createFilter } from '@rollup/pluginutils';
import type { Plugin } from 'rollup';
import { readFileSync } from 'fs';
const backtick = '`';

export default function rollupHbsPlugin(): Plugin {
  const filter = createFilter('**/*.hbs');

  return {
    name: 'rollup-hbs-plugin',
    async resolveId(source: string, importer: string | undefined, options) {
      const resolution = await this.resolve(source, importer, {
        skipSelf: true,
        ...options,
      });

      const id = resolution?.id;

      if (!filter(id)) return null;

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
