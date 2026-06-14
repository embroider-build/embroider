import { Preprocessor } from 'content-tag';
import { existsSync } from 'node:fs';
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
        if (!importer) return null;

        const fileName = path.join(path.dirname(importer), id);

        if (id.endsWith('.gts') && !importer.endsWith('.d.ts')) {
          gtsFiles.push(fileName);

          const newId = fileName.replace(/\.gts$/, '.ts');

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
          return fileName;
        } else if (id.endsWith('.ts') && !importer.endsWith('.d.ts')) {
          const gtsFileName = fileName.replace(/\.ts$/, '.gts');

          if (existsSync(gtsFileName) && !existsSync(fileName)) {
            gtsFiles.push(gtsFileName);

            return {
              id: fileName,
              meta: {
                fileName: gtsFileName,
              },
            };
          }
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
        const meta = this.getModuleInfo(id)?.meta ?? {};
        const fileName = meta?.fileName;

        if (fileName) {
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
        // Rewrite .gts imports in declaration files to .d.ts so the dts bundler
        // can resolve them as regular declaration files.
        if (input.includes('.gts') && id.endsWith('.d.ts')) {
          input = input.replace(
            /(['"`])((?:\.\.?\/|\/|@|[A-Za-z0-9_\-])[^'"]*?\.gts)\1/g,
            (_m, q, p) => `${q}${p.replace(/\.gts$/, '.d.ts')}${q}`
          );
        }

        // Rewrite .gts imports in source files to .ts. From this point on
        // rolldown-plugin-dts only sees virtual .ts files and never needs to
        // know that .gts files exist.
        if (input.includes('.gts') && !id.endsWith('.d.ts')) {
          input = input.replace(
            /(['"`])((?:\.\.?\/|\/|@|[A-Za-z0-9_\-])[^'"]*?\.gts)\1/g,
            (_m, q, p) => `${q}${p.replace(/\.gts$/, '.ts')}${q}`
          );
        }

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
