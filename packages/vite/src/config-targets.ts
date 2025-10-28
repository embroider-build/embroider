import browserslistToEsbuild from 'browserslist-to-esbuild';
import { existsSync } from 'fs';
import { join } from 'path';
import { pathToFileURL } from 'url';

export function configTargets() {
  return {
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
  };
}
