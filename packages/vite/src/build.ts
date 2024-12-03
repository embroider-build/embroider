import { fork } from 'child_process';
import type { Plugin } from 'vite';

export function emberBuild(command: string, mode: string, resolvableExtensions: string[] | undefined): Promise<void> {
  let env: Record<string, string> = {
    ...process.env,
    EMBROIDER_PREBUILD: 'true',
  };

  if (resolvableExtensions) {
    env['EMBROIDER_RESOLVABLE_EXTENSIONS'] = resolvableExtensions?.join(',');
  }

  if (command === 'build') {
    return new Promise((resolve, reject) => {
      const child = fork(
        './node_modules/ember-cli/bin/ember',
        ['build', '--environment', mode, '-o', 'tmp/compat-prebuild', '--suppress-sizes'],
        { env }
      );
      child.on('exit', code => (code === 0 ? resolve() : reject()));
    });
  }
  return new Promise((resolve, reject) => {
    const child = fork(
      './node_modules/ember-cli/bin/ember',
      ['build', '--watch', '--environment', mode, '-o', 'tmp/compat-prebuild', '--suppress-sizes'],
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

export function compatPrebuild(): Plugin {
  let viteCommand: string | undefined;
  let viteMode: string | undefined;
  let resolvableExtensions: string[] | undefined;

  return {
    name: 'embroider-builder',
    enforce: 'pre',
    config(config, { mode, command }) {
      viteCommand = command;
      viteMode = mode;
      resolvableExtensions = config.resolve?.extensions;
    },
    async buildStart() {
      if (!viteCommand) {
        throw new Error(`bug: embroider compatPrebuild did not detect Vite's command`);
      }
      if (!viteMode) {
        throw new Error(`bug: embroider compatPrebuild did not detect Vite's mode`);
      }
      await emberBuild(viteCommand, viteMode, resolvableExtensions);
    },
  };
}
