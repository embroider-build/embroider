import walkSync from 'walk-sync';
import { rmSync } from 'fs';
import { join } from 'path';
import type { Plugin } from 'rollup';
import { existsSync } from 'fs-extra';

export default function clean(): Plugin {
  const changed = new Set();
  return {
    name: 'clean',
    transform(_code, id) {
      console.log(id);
      changed.add(id);
      return;
    },
    generateBundle(options, bundle) {
      if (existsSync(options.dir!)) {
        const files = walkSync(options.dir!, {
          globs: ['*/**'],
          directories: false,
        });
        for (const file of files) {
          if (!bundle[file]) {
            rmSync(join(options.dir!, file));
          }
        }
      }

      for (const key of Object.keys(bundle)) {
        let checkKey = key;
        if (key.endsWith('.js.map')) {
          checkKey = key.replace('.js.map', '.js');
          if (!bundle[checkKey]) {
            delete bundle[key];
            continue;
          }
        }
        if (
          (bundle[checkKey] as any).moduleIds?.every(
            (m: string) => !changed.has(m)
          )
        ) {
          delete bundle[key];
          console.log('deleted', key);
          continue;
        }
        console.log('not deleted', key);
      }
      changed.clear();
    },
  };
}
