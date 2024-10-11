import { fork } from 'child_process';
import type { UnpluginFactory } from 'unplugin';
import { createUnplugin } from 'unplugin';

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
      const child = fork('./node_modules/ember-cli/bin/ember', ['build', '--environment', mode], { env });
      child.on('exit', code => (code === 0 ? resolve() : reject()));
    });
  }
  return new Promise((resolve, reject) => {
    const child = fork('./node_modules/ember-cli/bin/ember', ['build', '--watch', '--environment', mode], {
      silent: true,
      env,
    });
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

const compatPrebuildFactory: UnpluginFactory<undefined> = (_options, meta) => {
  let packager = meta.framework;
  let command: string | undefined;
  let mode: string | undefined;
  let resolvableExtensions: string[] | undefined;

  return {
    name: 'embroider-builder',
    enforce: 'pre',
    vite: {
      config(config: { resolve?: { extensions: string[] } }, env: { mode: string; command: string }) {
        command = env.command;
        mode = env.mode;
        resolvableExtensions = config.resolve?.extensions;
      },
    },
    webpack(/* compiler */) {
      // TODO: unhard-code all this
      command ??= 'start';
      mode ??= 'development';
      resolvableExtensions ??= ['.gjs', '.js', '.gts', '.ts', '.hbs'];
    },
    async buildStart() {
      if (!command) {
        throw new Error(`bug: embroider compatPrebuild did not detect ${packager}'s command`);
      }

      if (!mode) {
        throw new Error(`bug: embroider compatPrebuild did not detect ${packager}'s mode`);
      }

      await emberBuild(command, mode, resolvableExtensions);
    },
  };
};

export const compatPrebuild = /* #__PURE__ */ createUnplugin<undefined>(compatPrebuildFactory);
