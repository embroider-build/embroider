import { fork } from 'child_process';
import type { Plugin } from 'vite';

export function emberBuild(command: string, mode: string): Promise<void> {
  if (command === 'build') {
    return new Promise((resolve, reject) => {
      const child = fork('./node_modules/ember-cli/bin/ember', ['build', '--environment', mode], {
        env: {
          ...process.env,
          EMBROIDER_PREBUILD: 'true',
        },
      });
      child.on('exit', code => (code === 0 ? resolve() : reject()));
    });
  }
  return new Promise((resolve, reject) => {
    const child = fork('./node_modules/ember-cli/bin/ember', ['build', '--watch', '--environment', mode], {
      silent: true,
      env: {
        ...process.env,
        EMBROIDER_PREBUILD: 'true',
      },
    });
    child.on('exit', code => {
      console.log('ember child has exited');
      return code === 0 ? resolve() : reject(new Error('ember build --watch failed'));
    });
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

    process.on('exit', function () {
      console.log('killing ember process on exit');
      child.kill();
    });

    process.on('SIGINT', function () {
      console.log('killing ember process on sigint');
      child.kill();
    });

    // catches "kill pid" (for example: nodemon restart)
    process.on('SIGUSR1', function () {
      console.log('killing ember process on sigusr1');
      child.kill();
    });
    process.on('SIGUSR2', function () {
      console.log('killing ember process on sigusr2');
      child.kill();
    });
  });
}

export function compatPrebuild(): Plugin {
  let viteCommand: string | undefined;
  let viteMode: string | undefined;

  return {
    name: 'embroider-builder',
    enforce: 'pre',
    config(_config, { mode, command }) {
      viteCommand = command;
      viteMode = mode;
    },
    async buildStart() {
      if (!viteCommand) {
        throw new Error(`bug: embroider compatPrebuild did not detect Vite's command`);
      }
      if (!viteMode) {
        throw new Error(`bug: embroider compatPrebuild did not detect Vite's mode`);
      }
      await emberBuild(viteCommand, viteMode);
    },
  };
}
