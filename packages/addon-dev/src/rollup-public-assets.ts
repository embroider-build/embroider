import { readJsonSync, writeJsonSync } from 'fs-extra/esm';
import walkSync from 'walk-sync';
import type { Plugin } from 'rollup';

export default function publicAssets(
  path: string,
  opts: { include: string[]; exclude: string[] }
): Plugin {
  const includeGlobPatterns = opts?.include;
  const excludedGlobPatterns = opts?.exclude || [];

  return {
    name: 'public-assets-bundler',

    // Prior to https://github.com/rollup/rollup/pull/5270, we cannot call this
    // from within `generateBundle`
    buildStart() {
      this.addWatchFile(path);
    },

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

      let originalPublicAssets = pkg['ember-addon']?.['public-assets'];

      let hasChanges =
        JSON.stringify(originalPublicAssets) !== JSON.stringify(publicAssets);

      if (hasChanges) {
        pkg['ember-addon'] = Object.assign({}, pkg['ember-addon'], {
          'public-assets': publicAssets,
        });

        writeJsonSync('package.json', pkg, { spaces: 2 });
      }
    },
  };
}
