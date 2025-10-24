import { fork } from 'child_process';
import type { Plugin } from 'vite';
import { getLockfileHash, locateEmbroiderWorkingDir } from '@embroider/core';
import { readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve, relative, join, dirname } from 'node:path';

const require = createRequire(import.meta.url);

export function emberBuild(
  command: string,
  mode: string,
  resolvableExtensions: string[] | undefined,
  options: CompatPrebuildOptions
): Promise<void> {
  let shouldWatch = options?.watch ?? true;

  let env: Record<string, string> = {
    ...process.env,
    EMBROIDER_PREBUILD: 'true',
  };

  let emberCLIMain = require.resolve('ember-cli', { paths: [process.cwd()] });
  if (!emberCLIMain) {
    throw new Error('Could not resolve ember-cli');
  }
  let emberCLI = join(dirname(emberCLIMain), '../../bin/ember');

  if (resolvableExtensions) {
    env['EMBROIDER_RESOLVABLE_EXTENSIONS'] = resolvableExtensions?.join(',');
  }

  if (command === 'build') {
    return new Promise((resolve, reject) => {
      const child = fork(emberCLI, ['build', '--environment', mode, '-o', 'tmp/compat-prebuild', '--suppress-sizes'], {
        env,
      });
      child.on('exit', code => (code === 0 ? resolve() : reject()));
    });
  }
  return new Promise((resolve, reject) => {
    let watchArgs = shouldWatch ? ['--watch'] : [];

    const child = fork(
      emberCLI,
      ['build', ...watchArgs, '--environment', mode, '-o', 'tmp/compat-prebuild', '--suppress-sizes'],
      {
        silent: true,
        env,
      }
    );
    child.on('exit', code => (code === 0 ? resolve() : reject(new Error('ember build --watch failed'))));
    child.on('spawn', () => {
      child.stderr?.on('data', data => {
        console.error(data.toString());
      });
      child.stdout!.on('data', data => {
        console.log(data.toString());
        if (data.toString().includes('Build successful')) {
          resolve();
        }
      });
    });
  });
}

interface CompatPrebuildOptions {
  watch?: boolean;
  reusePrebuild?: boolean;
}

export function compatPrebuild(options: CompatPrebuildOptions = {}): Plugin {
  let viteCommand: string | undefined;
  let viteMode: string | undefined;
  let resolvableExtensions: string[] | undefined;
  let isForce = false;

  return {
    name: 'embroider-builder',
    enforce: 'pre',
    config(config, { mode, command }) {
      viteCommand = process.env.EMBROIDER_VITE_COMMAND ?? command;
      viteMode = mode;
      // @ts-expect-error - not every version of vite has *types* for server.force
      isForce = Boolean(config.server?.force);
      resolvableExtensions = config.resolve?.extensions;
    },
    async buildStart() {
      if (!viteCommand) {
        throw new Error(`bug: embroider compatPrebuild did not detect Vite's command`);
      }
      if (!viteMode) {
        throw new Error(`bug: embroider compatPrebuild did not detect Vite's mode`);
      }

      if (options?.reusePrebuild) {
        let working = locateEmbroiderWorkingDir(process.cwd());
        let versions: Record<string, string> = {};

        let versionPath = resolve(working, 'version.json');

        try {
          versions = JSON.parse(readFileSync(versionPath, 'utf8'));
        } catch (err) {}

        let root = process.cwd();
        let lockfileHash = getLockfileHash({ config: { root } });

        if (!isForce) {
          let shouldUsePrebuild = versions['lockfileHash'] && versions['lockfileHash'] === lockfileHash;

          if (shouldUsePrebuild) {
            console.log(`Reusing addon prebuild in ${relative(root, working)}`);
            return;
          }
        } else {
          console.log(`Re-running compatPrebuild due to --force`);
        }

        /**
         * If we are opting in to reuse the prebuild, and there is no prebuild, we must build once without watching.
         *
         * Next time we end up in this execution flow, we'll hopefully hit the true-case in the above if condition,
         * resulting in an early return, and skipping this build
         */
        await emberBuild(viteCommand, viteMode, resolvableExtensions, {
          ...options,
          watch: false,
        });

        versions['lockfileHash'] = lockfileHash;
        await writeFile(versionPath, JSON.stringify(versions, null, 2));

        return;
      }

      await emberBuild(viteCommand, viteMode, resolvableExtensions, options);
    },
  };
}
