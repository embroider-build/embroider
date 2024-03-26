import walkSync from 'walk-sync';
import { rmSync } from 'fs';
import { join } from 'path';
import type { Plugin } from 'rollup';

export default function clean(): Plugin {
  return {
    name: 'clean',
    writeBundle(options, bundle) {
      const files = walkSync(options.dir!, {
        globs: ['*/**'],
        directories: false,
      });
      for (const file of files) {
        if (!bundle[file]) {
          rmSync(join(options.dir!, file));
        }
      }
    },
  };
}
