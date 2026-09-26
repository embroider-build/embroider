import browserslist from 'browserslist';
import browserslistToEsbuild from 'browserslist-to-esbuild';
import chalk from 'chalk';
import { existsSync } from 'fs';
import { join } from 'path';
import { pathToFileURL } from 'url';

function warnTargetsFile(message: string) {
  console.log(`\n${chalk.bold.yellow('WARNING')}\n${chalk.yellow(message)}`);
  console.log(
    'Move the browsers list from config/targets.js to the "browserslist" key in package.json, then delete config/targets.js.\n'
  );
}

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
            warnTargetsFile(
              'Browser targets are defined in both config/targets.js and your browserslist config. Embroider uses config/targets.js, but other tools use the browserslist config.'
            );
          } else {
            warnTargetsFile('config/targets.js is no longer the recommended way to set browser targets.');
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
