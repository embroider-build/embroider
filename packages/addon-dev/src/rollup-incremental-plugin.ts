import walkSync from 'walk-sync';
import { rmSync } from 'fs';
import { join } from 'path';
import type { OutputAsset, Plugin } from 'rollup';
import { existsSync } from 'fs-extra';

export default function incremental(): Plugin {
  const changed = new Set();
  const generatedAssets = new Map();
  return {
    name: 'clean',
    transform(_code, id) {
      changed.add(id);
      // support colocation changes
      // could also be done directly in the babel plugin
      // by passing rollup context into it
      let hbsFilename = id.replace(/\.\w{1,3}$/, '') + '.hbs';
      if (hbsFilename !== id && existsSync(hbsFilename)) {
        this.addWatchFile(hbsFilename);
      }
    },
    generateBundle(options, bundle) {
      if (existsSync(options.dir!)) {
        const files = walkSync(options.dir!, {
          globs: ['*/**'],
          directories: false,
        });
        for (const file of files) {
          if (!bundle[file]) {
            generatedAssets.delete(file);
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
          bundle[checkKey]?.type === 'asset' &&
          (bundle[checkKey] as OutputAsset).source ===
            generatedAssets.get(checkKey)
        ) {
          delete bundle[key];
          continue;
        } else {
          generatedAssets.set(
            checkKey,
            (bundle[checkKey] as OutputAsset).source
          );
        }
        if (
          (bundle[checkKey] as any)?.moduleIds?.every(
            (m: string) => !changed.has(m)
          )
        ) {
          delete bundle[key];
          continue;
        }
      }
      changed.clear();
    },
  };
}
