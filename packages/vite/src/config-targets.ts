import browserslist from 'browserslist';
import browserslistToEsbuild from 'browserslist-to-esbuild';
import chalk from 'chalk';
import { existsSync } from 'fs';
import { join } from 'path';
import { pathToFileURL } from 'url';

export function configTargets() {
  return {
    name: 'vite-plugin-ember-browser-targets',
    async config() {
      const root = process.cwd();
      const targetsPath = join(root, 'config/targets.js');
      // package.json#browserslist, .browserslistrc, or the BROWSERSLIST env var
      const browserslistConfig = browserslist.loadConfig({ path: root });

      if (existsSync(targetsPath)) {
        const targets = await import(pathToFileURL(targetsPath).toString());
        const browsers = targets.default?.browsers;

        if (browsers) {
          if (browserslistConfig) {
            console.log(
              `\n${chalk.bold.yellow('WARNING')}\n${chalk.yellow(
                'Browser targets are defined in both config/targets.js and your browserslist config.'
              )}`
            );
            console.log(
              'Embroider uses config/targets.js for the Vite build target, but tools that read browserslist directly will use the other list.'
            );
            console.log('Keep only one of them so every tool targets the same browsers.\n');
          }

          return {
            build: {
              target: browserslistToEsbuild(browsers),
            },
          };
        }
      }

      if (browserslistConfig) {
        return {
          build: {
            target: browserslistToEsbuild(browserslistConfig),
          },
        };
      }
    },
  };
}
