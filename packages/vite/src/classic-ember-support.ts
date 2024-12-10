import { hbs } from './hbs.js';
import { scripts } from './scripts.js';
import { compatPrebuild } from './build.js';
import { assets } from './assets.js';
import { contentFor } from './content-for.js';
import browserslistToEsbuild from 'browserslist-to-esbuild';
import { existsSync } from 'fs';
import { join } from 'path';
import { mergeConfig, type UserConfig } from 'vite';
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
      async config(userConfig: UserConfig) {
        const targetsPath = join(process.cwd(), 'config/targets.js');
        if (existsSync(targetsPath)) {
          const targets = await import(pathToFileURL(targetsPath).toString());
          if (targets.default.browsers) {
            return mergeConfig(
              {
                build: {
                  target: browserslistToEsbuild(targets.browsers),
                },
              },
              userConfig
            );
          }
        }
        return userConfig;
      },
    },
  ];
}
