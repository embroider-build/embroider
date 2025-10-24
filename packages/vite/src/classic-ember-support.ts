import { hbs } from './hbs.js';
import { scripts } from './scripts.js';
import { compatPrebuild } from './build.js';
import { assets } from './assets.js';
import { contentFor } from './content-for.js';
import browserslistToEsbuild from 'browserslist-to-esbuild';
import { existsSync } from 'fs';
import { join } from 'path';
import { pathToFileURL } from 'url';

interface Options {
  /**
   * Whether or not to start ember-cli in watch mode.
   * Defaults to true.
   */
  watch?: boolean;

  /**
   * Specifies whether to skip prebuild next time the vite is invoked.
   * This re-uses the output from the node_modules/.embroider folder
   * from the previous build.
   *
   * Defaults to false.
   */
  reusePrebuild?: boolean;
}

export function classicEmberSupport(options: Options = {}) {
  return [
    hbs(),
    contentFor(),
    scripts(),
    compatPrebuild(options),
    assets(),
    {
      name: 'vite-plugin-ember-browser-targets',
      async config() {
        const targetsPath = join(process.cwd(), 'config/targets.js');
        if (existsSync(targetsPath)) {
          const targets = await import(pathToFileURL(targetsPath).toString());
          if (targets.default.browsers) {
            return {
              build: {
                target: browserslistToEsbuild(targets.browsers),
              },
            };
          }
        }
      },
    },
  ];
}
