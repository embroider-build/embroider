import { readJsonSync, writeJsonSync } from 'fs-extra';
import walkSync from 'walk-sync';
import type { Plugin } from 'rollup';
import { hasChanges } from './utils';

export default function publicAssets(
  path: string,
  opts: { include: string[]; exclude: string[] }
): Plugin {
  const includeGlobPatterns = opts?.include;
  const excludedGlobPatterns = opts?.exclude || [];

  return {
    name: 'public-assets-bundler',
    generateBundle() {
      let pkg = readJsonSync('package.json');
      const filenames = walkSync(path, {
        directories: false,
        globs: includeGlobPatterns,
        ignore: excludedGlobPatterns,
      });
      const publicAssets: Record<string, string> = filenames.reduce(
        (acc: Record<string, string>, v): Record<string, string> => {
          acc[`./${path}/${v}`] = ['/', pkg.name, '/', path, '/', v].join('');
          return acc;
        },
        {}
      );

      if (hasChanges(pkg['ember-addon']?.['public-assets'], publicAssets)) {
        pkg['ember-addon'] = Object.assign({}, pkg['ember-addon'], {
          'public-assets': publicAssets,
        });

        writeJsonSync('package.json', pkg, { spaces: 2 });
      }
    },
  };
}
