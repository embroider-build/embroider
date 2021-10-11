import { readJsonSync, writeJsonSync } from 'fs-extra';
import minimatch from 'minimatch';
import type { Plugin } from 'rollup';

export default function appReexports(opts: {
  from: string;
  to: string;
  include: string[];
}): Plugin {
  return {
    name: 'app-reexports',
    generateBundle(_, bundle) {
      let pkg = readJsonSync('package.json');
      let appJS: Record<string, string> = {};
      for (let filename of Object.keys(bundle)) {
        if (opts.include.some((glob) => minimatch(filename, glob))) {
          appJS[`./${filename}`] = `./dist/_app_/${filename}`;
          this.emitFile({
            type: 'asset',
            fileName: `_app_/${filename}`,
            source: `export { default } from "${pkg.name}/${filename}";\n`,
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
