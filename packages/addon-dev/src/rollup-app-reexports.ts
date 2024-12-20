import { readJsonSync, writeJsonSync } from 'fs-extra';
import { extname } from 'path';
import minimatch from 'minimatch';
import type { Plugin } from 'rollup';

function symmetricDifference(arr1: any[], arr2: any[]) {
  return arr1
    .filter((x) => !arr2.includes(x))
    .concat(arr2.filter((x) => !arr1.includes(x)));
}

export default function appReexports(opts: {
  from: string;
  to: string;
  include: string[];
  exclude?: string[];
  mapFilename?: (filename: string) => string;
  exports?: (filename: string) => string[] | string | undefined;
}): Plugin {
  return {
    name: 'app-reexports',
    generateBundle(_, bundle) {
      let pkg = readJsonSync('package.json');
      let appJS: Record<string, string> = {};
      for (let addonFilename of Object.keys(bundle)) {
        let appFilename = opts.mapFilename?.(addonFilename) ?? addonFilename;
        let appExports = opts.exports?.(addonFilename) || ['default'];

        let computedExports =
          typeof appExports === 'string'
            ? appExports
            : `{ ${appExports.join(', ')} }`;

        if (
          opts.include.some((glob) => minimatch(addonFilename, glob)) &&
          !minimatch(addonFilename, '**/*.d.ts') &&
          opts.exclude?.some((glob) => minimatch(addonFilename, glob)) !== true
        ) {
          appJS[`./${appFilename}`] = `./dist/_app_/${appFilename}`;
          this.emitFile({
            type: 'asset',
            fileName: `_app_/${appFilename}`,
            source: `export ${computedExports} from "${
              pkg.name
            }/${addonFilename.slice(0, -extname(addonFilename).length)}";\n`,
          });
        }
      }
      let originalAppJS = pkg['ember-addon']?.['app-js'];

      let hasChanges = !!symmetricDifference(
        Object.keys(originalAppJS),
        Object.keys(appJS)
      ).length;

      // Don't cause a file i/o event unless something actually changed
      if (hasChanges) {
        pkg['ember-addon'] = Object.assign({}, pkg['ember-addon'], {
          'app-js': appJS,
        });
        writeJsonSync('package.json', pkg, { spaces: 2 });
      }
    },
  };
}
