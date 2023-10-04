import { readJsonSync, writeJsonSync } from 'fs-extra';
import { extname } from 'path';
import minimatch from 'minimatch';
import type { Plugin } from 'rollup';

export default function appReexports(opts: {
  from: string;
  to: string;
  include: string[];
  mapFilename?: (filename: string) => string;
}): Plugin {
  return {
    name: 'app-reexports',
    generateBundle(_, bundle) {
      let pkg = readJsonSync('package.json');
      let appJS: Record<string, string> = {};
      for (let addonFilename of Object.keys(bundle)) {
        let appFilename = opts.mapFilename?.(addonFilename) ?? addonFilename;

        if (
          opts.include.some((glob) => minimatch(addonFilename, glob)) &&
          !minimatch(addonFilename, '**/*.d.ts')
        ) {
          appJS[`./${appFilename}`] = `./dist/_app_/${appFilename}`;
          if (extname(appFilename) === '.hbs') {
            this.emitFile({
              type: 'asset',
              fileName: `_app_/${appFilename}`,
              source: (bundle[appFilename] as any).source,
            });
          } else {
            this.emitFile({
              type: 'asset',
              fileName: `_app_/${appFilename}`,
              source: `export { default } from "${
                pkg.name
              }/${addonFilename.slice(0, -extname(addonFilename).length)}";\n`,
            });
          }
        }
      }
      let originalAppJS = pkg['ember-addon']?.['app-js'];

      let hasChanges = JSON.stringify(originalAppJS) !== JSON.stringify(appJS);

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
