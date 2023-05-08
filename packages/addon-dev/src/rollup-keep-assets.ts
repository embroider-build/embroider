import walkSync from 'walk-sync';
import type { Plugin } from 'rollup';
import { readFileSync } from 'fs';
import { join } from 'path';
import minimatch from 'minimatch';

export default function keepAssets({
  from,
  include,
}: {
  from: string;
  include: string[];
}): Plugin {
  return {
    name: 'copy-assets',

    // imports of assets should be left alone in the source code. This can cover
    // the case of .css as defined in the embroider v2 addon spec.
    async resolveId(source, importer, options) {
      // We need to check if the `source` (what the importer is trying to import)
      // matches our patterns, because we don't want to hit the file system if
      // the pattern doesn't match.
      //
      // Without doing so can multiply the build time by 3x.
      let isMatch = include.some((pattern) => minimatch(source, pattern));

      // Let some other plugin handle this source
      if (!isMatch) return null;

      const resolution = await this.resolve(source, importer, {
        skipSelf: true,
        ...options,
      });

      if (resolution) {
        return { id: source, external: true };
      }

      return resolution;
    },

    // the assets go into the output directory in the same relative locations as
    // in the input directory
    async generateBundle() {
      for (let name of walkSync(from, {
        globs: include,
        directories: false,
      })) {
        this.emitFile({
          type: 'asset',
          fileName: name,
          source: readFileSync(join(from, name), 'utf8'),
        });
      }
    },
  };
}
