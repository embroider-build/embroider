import walkSync from 'walk-sync';
import type { Plugin } from 'rollup';
import { readFileSync } from 'fs';
import { readJsonSync, writeJsonSync } from 'fs-extra';
import { join } from 'path';
import minimatch from 'minimatch';

export default function keepAssets({
  from,
  to,
  include,
  mapPath,
}: {
  from: string;
  to: string;
  include: string[];
  mapPath?: (srcPath: string) => string;
}): Plugin {
  return {
    name: 'copy-assets',

    // imports of assets should be left alone in the source code. This can cover
    // the case of .css as defined in the embroider v2 addon spec.
    async resolveId(source, importer, options) {
      const resolution = await this.resolve(source, importer, {
        skipSelf: true,
        ...options,
      });
      if (
        resolution &&
        include.some((pattern) => minimatch(resolution.id, pattern))
      ) {
        return { id: source, external: true };
      }
      return resolution;
    },

    // the assets go into the output directory in the same relative locations as
    // in the input directory
    async generateBundle() {
      let pkg = readJsonSync('package.json');
      let packageName: string = pkg.name;
      let publicAssets: Record<string, string> = {};

      for (let name of walkSync(from, {
        globs: include,
        directories: false,
      })) {
        this.emitFile({
          type: 'asset',
          fileName: name,
          source: readFileSync(join(from, name), 'utf8'),
        });

        publicAssets[`${to}/${name}`] =
          mapPath?.(name) ?? `/${packageName}/${name}`;
      }

      pkg['ember-addon'] = Object.assign({}, pkg['ember-addon'], {
        'public-assets': publicAssets,
      });

      writeJsonSync('package.json', pkg, { spaces: 2 });
    },
  };
}
