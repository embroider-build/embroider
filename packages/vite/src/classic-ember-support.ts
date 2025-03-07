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
    scripts(),
    compatPrebuild(),
    assets(),
    contentFor(),
    {
      name: 'vite-plugin-ember-browser-targets',
      async config() {
        const targetsPath = join(process.cwd(), 'config/targets.js');
        if (existsSync(targetsPath)) {
          let target = await import(pathToFileURL(targetsPath).toString());
          if (target.default.browsers) {
            target = browserslistToEsbuild(target.browsers);
            return {
              build: {
                target,
              },
              optimizeDeps: {
                esbuildOptions: {
                  target,
                },
              },
            };
          }
        }
      },
    },
  ];
}
