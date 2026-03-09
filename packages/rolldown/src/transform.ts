import { Preprocessor } from 'content-tag';
import { readFile } from 'node:fs/promises';
import type { Plugin } from 'rolldown';
import path from 'node:path';

const processor = new Preprocessor();

// maps `.gts` -> `.ts`, so rolldown can identify it as ts and apply its transform
export function emberTransform(): Plugin {
  const gtsFiles: string[] = [];

  return {
    name: 'ember:transform',

    resolveId: {
      order: 'pre',
      handler(id, importer) {
        console.log('RESOLVE', id, 'from', importer);

        if (!importer) return null;

        const fileName = importer ? path.join(path.dirname(importer), id) : id;

        if (id.endsWith('.gts') && !importer.endsWith('.d.ts')) {
          // const newId = id.replace(/\.gts$/, '.ts');

          gtsFiles.push(fileName);

          const newId = fileName.replace(/\.gts$/, '.ts');

          console.log('resolve [src]', id, 'from', importer, newId);

          return {
            id: newId,
            meta: {
              fileName,
            },
          };
        } else if (
          id.endsWith('.d.ts') &&
          importer.endsWith('.d.ts') &&
          gtsFiles.includes(fileName.replace('.d.ts', '.gts'))
        ) {
          const newId = id.replace(/\.gts$/, '.d.ts');
          console.log('resolve [types]', id, 'from', importer, fileName);
          return fileName;
        }

        return null;
      },
    },

    load: {
      order: 'pre',
      filter: {
        id: /\.ts$/,
      },
      async handler(id) {
        console.log('LOAD', id, this.getModuleInfo(id), 'resolveId:');

        const meta = this.getModuleInfo(id)?.meta ?? {};
        const fileName = meta?.fileName;

        if (fileName /*&& fileName.endsWith('.gts')*/) {
          console.log('-> FROM', fileName);

          return await readFile(fileName, { encoding: 'utf8' });
        }

        return null;
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
        if (input.includes('.gts') && id.endsWith('.d.ts')) {
          console.log('TRANSFORM [imports]', id);
          const remappedImports = input.replace(
            /(['"`])((?:\.\.?\/|\/|@|[A-Za-z0-9_\-])[^'"]*?\.gts)\1/g,
            (_m, q, p) => `${q}${p.replace(/\.gts$/, id.includes('.d.ts') ? '.d.ts' : '.ts')}${q}`
          );

          console.log('REPLACE import', { id, input, remappedImports });
          input = remappedImports;
        }

        // console.log('TRANSFORM', id, 'original code:\n', input);

        if (input.includes('<template>')) {
          console.log('TRANSFORM [code]', id);
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

    // moduleParsed(mod) {
    //   console.log('MODULE PARSED', mod.id, mod.code);
    // },
  };
}
