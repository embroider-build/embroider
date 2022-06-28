import walkSync from 'walk-sync';
import { join } from 'path';
import minimatch from 'minimatch';
import { pathExistsSync } from 'fs-extra';

import type { Plugin } from 'rollup';

function normalizeFileExt(fileName: string) {
  return fileName.replace(/\.ts|\.hbs|\.gts|\.gjs$/, '.js');
}

export default function publicEntrypoints(args: {
  srcDir: string;
  include: string[];
}): Plugin {
  return {
    name: 'addon-modules',
    async buildStart() {
      let matches = walkSync(args.srcDir, {
        globs: [...args.include, '**/*.hbs', '**/*.ts', '**/*.gts', '**/*.gjs'],
      });

      for (let name of matches) {
        if (args.include.some((pattern) => minimatch(name, pattern))) {
          // anything that matches one of the user's patterns is definitely emitted
          this.emitFile({
            type: 'chunk',
            id: join(args.srcDir, name),
            fileName: normalizeFileExt(name),
          });
        } else {
          // this file didn't match one of the user's patterns, so it must match
          // our hbsPattern. Infer the possible existence of a synthesized
          // template-only component JS file and test whether that file would
          // match the user's patterns.
          let normalizedName = normalizeFileExt(name);
          let id = join(args.srcDir, normalizedName);
          let normalizedMatch = args.include.some((pattern) =>
            minimatch(normalizedName, pattern)
          );
          let normalizedExists = pathExistsSync(id);

          let matchesDeferred = [...args.include, '**/*.ts'].some((pattern) =>
            minimatch(name, pattern)
          );

          // for files that we know are going to be processed by other
          // plugins, change as little as possible.
          if (matchesDeferred) {
            this.emitFile({
              type: 'chunk',
              id: join(args.srcDir, name),
              fileName: normalizedName,
            });

            continue;
          }

          if (normalizedMatch && !normalizedExists) {
            this.emitFile({
              type: 'chunk',
              id,
              fileName: normalizedName,
            });
          }
        }
      }
    },
  };
}
