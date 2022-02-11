import walkSync from 'walk-sync';
import { join } from 'path';

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
        globs: [...args.include],
      });

      for (let name of matches) {
        this.emitFile({
          type: 'chunk',
          id: join(args.srcDir, name),
          fileName: normalizeFileExt(name),
        });
      }
    },
  };
}
