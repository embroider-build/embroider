import { readJsonSync, writeJsonSync } from 'fs-extra';
import walkSync from 'walk-sync';
import type { Plugin } from 'rollup';
import { resolve, join } from 'path/posix';

export interface PublicAssetsOptions {
  /**
   * glob pattern passed to `walkSync.include` to pick files
   */
  include?: string[];

  /**
   * glob pattern passed to `walkSync.ignore` to exclude files
   */
  exclude?: string[];

  /**
   * namespace to expose files
   */
  namespace?: string;
}

/**
 * A rollup plugin to expose a folder of assets
 *
 * @param path - the public folder that you want to add as public assets
 * @returns
 */
export default function publicAssets(
  path: string,
  opts?: PublicAssetsOptions
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
          acc[`./${path}/${v}`] = resolve(
            '/' + join(opts?.namespace ?? pkg.name, path, v)
          );
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
