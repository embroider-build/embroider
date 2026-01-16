import { Preprocessor } from 'content-tag';
import { readFile } from 'node:fs/promises';
import type { Plugin } from 'rolldown';
import path from 'node:path';

const processor = new Preprocessor();

// maps `.gts` -> `.ts`, so rolldown can identify it as ts and apply its transform
export function emberTransform(): Plugin {
  return {
    name: 'ember-transform',

    resolveId: {
      order: 'pre',
      handler(id, importer) {
        if (!importer) return null;

        if (id.endsWith('.gts') && !importer.endsWith('.d.ts')) {
          const newId = id.replace(/\.gts$/, '.ts');
          console.log('resolve', id, 'from', importer, newId);

          const fileName = importer ? path.join(path.dirname(importer), id) : id;

          return {
            id: newId,
            meta: {
              fileName,
            },
          };
        } else if (id.endsWith('.gts') && importer.endsWith('.d.ts')) {
          const newId = id.replace(/\.gts$/, '.d.ts');
          console.log('resolve', id, 'from', importer, newId);
          return newId;
        }

        return id;
      },
    },

    load: {
      order: 'pre',
      filter: {
        id: /\.ts$/,
      },
      async handler(id) {
        console.log('LOAD', id, this.getModuleInfo(id));

        const meta = this.getModuleInfo(id)?.meta ?? {};
        const fileName = meta?.fileName;

        if (fileName && fileName.endsWith('.gts')) {
          return await readFile(fileName, { encoding: 'utf8' });
        }
      },
    },

    transform: {
      order: 'pre',
      filter: {
        code: /<template>|\.gts/,
        id: /\.(gjs|ts)$/,
      },
      handler(input, id) {
        // my idea to rewrite the imports, so .d.ts can be done, but nope
        // if (input.includes('.gts')) {
        //   const remappedImports = input.replace(
        //     /(['"`])((?:\.\.?\/|\/|@|[A-Za-z0-9_\-])[^'"]*?\.gts)\1/g,
        //     (_m, q, p) => `${q}${p.replace(/\.gts$/, id.includes('.d.ts') ? '.d.ts' : '.ts')}${q}`
        //   );

        //   console.log('REPLACE import', { id, input, remappedImports });
        //   input = remappedImports;
        // }

        if (input.includes('<template>')) {
          const { code, map } = processor.process(input, {
            filename: id,
          });

          return {
            code,
            map,
          };
        }

        return input;
      },
    },
  };
}
