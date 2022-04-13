import walkSync from 'walk-sync';
import { join } from 'path';
import minimatch from 'minimatch';

import type { Plugin } from 'rollup';
import { pathExistsSync } from 'fs-extra';

function normalizeFileExt(fileName: string) {
  return fileName.replace(/\.ts|\.hbs|\.gts|\.gjs$/, '.js');
}

const hbsPattern = '**/*.hbs';

export default function publicEntrypoints(args: {
  srcDir: string;
  include: string[];
}): Plugin {
  return {
    name: 'addon-modules',
    async buildStart() {
      let matches = walkSync(args.srcDir, {
        globs: [...args.include, hbsPattern],
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
          if (
            args.include.some((pattern) =>
              minimatch(normalizedName, pattern)
            ) &&
            !pathExistsSync(id)
          ) {
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
