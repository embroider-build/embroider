import { readJsonSync, writeJsonSync } from 'fs-extra';
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
          this.emitFile({
            type: 'asset',
            fileName: `_app_/${appFilename}`,
            source: `export { default } from "${pkg.name}/${addonFilename}";\n`,
          });
        }
      }
      pkg['ember-addon'] = Object.assign({}, pkg['ember-addon'], {
        'app-js': appJS,
      });
      writeJsonSync('package.json', pkg, { spaces: 2 });
    },
  };
}
