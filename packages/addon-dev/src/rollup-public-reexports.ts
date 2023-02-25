import { readJsonSync, writeJsonSync } from 'fs-extra';
import walkSync from 'walk-sync';
import type { Plugin } from 'rollup';

export default function publicAssets(opts: { exclude: string[] }): Plugin {
  return {
    name: 'public-assets-bundler',
    generateBundle() {
      let pkg = readJsonSync('package.json');
      const filenames = walkSync('public', {
        directories: false,
        ignore: opts?.exclude || [],
      });
      const publicAssets: Record<string, string> = filenames.reduce(
        (acc: Record<string, string>, v): Record<string, string> => {
          acc['./public/' + v] = ['/', pkg.name, '/', v].join('');
          return acc;
        },
        {}
      );

      pkg['ember-addon'] = Object.assign({}, pkg['ember-addon'], {
        'public-assets': publicAssets,
      });

      writeJsonSync('package.json', pkg, { spaces: 2 });
    },
  };
}
