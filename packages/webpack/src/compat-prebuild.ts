import { fork } from 'child_process';
import { join, dirname } from 'node:path';
import type { Compiler } from 'webpack';

// The webpack equivalent of vite's `compatPrebuild` plugin / `emberBuild`. It
// forks `ember build` with EMBROIDER_PREBUILD=true, which (via compatBuild in
// the app's ember-cli-build.js) runs embroider's stage1+stage2 and writes the
// .embroider working directory (resolver.json, content-for.json, rewritten
// packages) plus the prebuilt vendor/test-support assets into
// tmp/compat-prebuild.
let prebuildPromise: Promise<void> | undefined;

export function runCompatPrebuild(mode: string, resolvableExtensions: string[] | undefined): Promise<void> {
  if (prebuildPromise) {
    return prebuildPromise;
  }

  let env: Record<string, string> = {
    ...(process.env as Record<string, string>),
    EMBROIDER_PREBUILD: 'true',
  };

  if (resolvableExtensions) {
    env['EMBROIDER_RESOLVABLE_EXTENSIONS'] = resolvableExtensions.join(',');
  }

  let emberCLIMain = require.resolve('ember-cli', { paths: [process.cwd()] });
  if (!emberCLIMain) {
    throw new Error('Could not resolve ember-cli');
  }
  let emberCLI = join(dirname(emberCLIMain), '../../bin/ember');

  prebuildPromise = new Promise<void>((resolve, reject) => {
    const child = fork(emberCLI, ['build', '--environment', mode, '-o', 'tmp/compat-prebuild', '--suppress-sizes'], {
      env,
    });
    child.on('exit', code => (code === 0 ? resolve() : reject(new Error('ember compat prebuild failed'))));
  });
  return prebuildPromise;
}

// A webpack plugin so the prebuild is sequenced (and its logs flushed) before
// the rest of compilation. The async `entry` function also awaits
// `runCompatPrebuild`, so the prebuild is guaranteed complete before any
// resolution happens regardless of plugin ordering.
export function compatPrebuild(mode: string, resolvableExtensions: string[] | undefined) {
  return {
    apply(compiler: Compiler) {
      const run = (_compiler: unknown, callback: (err?: Error) => void) => {
        runCompatPrebuild(mode, resolvableExtensions).then(
          () => callback(),
          err => callback(err)
        );
      };
      compiler.hooks.beforeRun.tapAsync('embroider-compat-prebuild', run);
      compiler.hooks.watchRun.tapAsync('embroider-compat-prebuild', run);
    },
  };
}
