import { fork } from 'child_process';
import type { Plugin } from 'vite';

export function emberBuild(mode: string): Promise<void> {
  if (mode === 'build') {
    return new Promise((resolve, reject) => {
      const child = fork('./node_modules/ember-cli/bin/ember', ['build', '--production'], { silent: true });
      child.on('exit', code => (code === 0 ? resolve() : reject()));
    });
  }
  return new Promise((resolve, reject) => {
    const child = fork('./node_modules/ember-cli/bin/ember', ['build', '--watch'], { silent: true });
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
  let mode = 'build';
  return {
    name: 'embroider-builder',
    enforce: 'pre',
    async configResolved(config) {
      if (config.command === 'serve') {
        mode = 'development';
      }
      await emberBuild(mode);
    },
  };
}
