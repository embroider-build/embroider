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

export interface PublicAssetsPathAndOptions extends PublicAssetsOptions {
  /**
   * the public folder that you want to add as public assets
   */
  path: string;
}

/**
 * A rollup plugin to expose a folder of assets
 *
 * @param pathsAndOptions - the public folders that you want to add as public assets
 * @returns
 */
export default function publicAssets(
  pathsAndOptions: readonly PublicAssetsPathAndOptions[]
): Plugin;
/**
 * A rollup plugin to expose a folder of assets
 *
 * @param path - the public folder that you want to add as public assets
 * @returns
 */
export default function publicAssets(
  path: string,
  opts?: PublicAssetsOptions
): Plugin;
export default function publicAssets(
  ...args:
    | [readonly PublicAssetsPathAndOptions[]]
    | [string, PublicAssetsOptions?]
): Plugin {
  const paths =
    typeof args[0] === 'string'
      ? [{ ...(args[1] ?? {}), path: args[0] }]
      : args[0];

  return {
    name: 'public-assets-bundler',

    // Prior to https://github.com/rollup/rollup/pull/5270, we cannot call this
    // from within `generateBundle`
    buildStart() {
      for (let { path } of paths) {
        this.addWatchFile(path);
      }
    },

    generateBundle() {
      let pkg = readJsonSync('package.json');

      const publicAssets: Record<string, string> = {};

      for (const { path, ...opts } of paths) {
        const filenames = walkSync(path, {
          directories: false,
          globs: opts?.include,
          ignore: opts?.exclude || [],
        });

        for (const filename of filenames) {
          const namespace = opts?.namespace ?? pkg.name;
          publicAssets[`./${path}/${filename}`] = resolve(
            '/' + join(namespace, filename)
          );
        }
      }

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
