import { hbs } from './hbs.js';
import { scripts } from './scripts.js';
import { compatPrebuild } from './build.js';
import { assets } from './assets.js';
import { contentFor } from './content-for.js';
import browserslistToEsbuild from 'browserslist-to-esbuild';
import { existsSync } from 'fs';
import { join } from 'path';
import { pathToFileURL } from 'url';

export function classicEmberSupport() {
  return [
    hbs(),
    contentFor(),
    scripts(),
    compatPrebuild(),
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
