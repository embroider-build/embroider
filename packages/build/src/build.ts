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

const compatPrebuildFactory: UnpluginFactory<undefined> = () => {
  return {
    name: 'embroider-builder',
    enforce: 'pre',
    async buildStart() {
      // TODO: unhard-code all this
      let command: 'build' | 'start' = 'start';
      let mode: 'development' | 'production' = 'development';
      let resolvableExtensions = ['.gjs', '.js', '.gts', '.ts', '.hbs'];

      await emberBuild(command, mode, resolvableExtensions);
    },
  };
};

export const compatPrebuild = /* #__PURE__ */ createUnplugin<undefined>(compatPrebuildFactory);
