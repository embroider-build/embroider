import { fork, type ChildProcess } from 'child_process';
import { join, dirname } from 'node:path';
import { locateEmbroiderWorkingDir } from '@embroider/core';
import type { Compiler } from 'webpack';

// The webpack equivalent of vite's `compatPrebuild` plugin / `emberBuild`. It
// forks `ember build` with EMBROIDER_PREBUILD=true, which (via compatBuild in
// the app's ember-cli-build.js) runs embroider's stage1+stage2 and writes the
// .embroider working directory (resolver.json, content-for.json, rewritten
// packages) plus the prebuilt vendor/test-support assets into
// tmp/compat-prebuild.
//
// In watch mode (`webpack serve` / `webpack --watch`) we spawn
// `ember build --watch` exactly like @embroider/vite's `emberBuild`: the first
// "Build successful" resolves the gate, and the child keeps running so the
// .embroider working dir is regenerated incrementally as app/addon source
// changes. Webpack then rebuilds because it watches that working dir (see the
// contextDependencies added below).
let prebuildPromise: Promise<void> | undefined;
let watchChild: ChildProcess | undefined;
let cleanupRegistered = false;

// Ensure the `ember build --watch` tree dies even if webpack's shutdown hooks
// don't run (e.g. the dev-server process is signalled directly). Without this,
// `webpack serve` shutdown waits on a child tree that never exits and CI hangs.
function registerProcessCleanup(): void {
  if (cleanupRegistered) {
    return;
  }
  cleanupRegistered = true;
  process.once('exit', stopCompatPrebuild);
  // Use addListener (not once) without re-raising: we only need to reap the
  // watch tree quickly. webpack-dev-server installs its own SIGINT/SIGTERM
  // handler that performs the actual graceful shutdown + process exit; ours
  // just makes sure that shutdown isn't blocked waiting on the watcher tree.
  for (let signal of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) {
    process.on(signal, stopCompatPrebuild);
  }
}

function emberCLIBin(): string {
  let emberCLIMain = require.resolve('ember-cli', { paths: [process.cwd()] });
  if (!emberCLIMain) {
    throw new Error('Could not resolve ember-cli');
  }
  return join(dirname(emberCLIMain), '../../bin/ember');
}

export function runCompatPrebuild(
  mode: string,
  resolvableExtensions: string[] | undefined,
  watch = false
): Promise<void> {
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

  let emberCLI = emberCLIBin();

  if (!watch) {
    prebuildPromise = new Promise<void>((resolve, reject) => {
      const child = fork(emberCLI, ['build', '--environment', mode, '-o', 'tmp/compat-prebuild', '--suppress-sizes'], {
        env,
      });
      child.on('exit', code => (code === 0 ? resolve() : reject(new Error('ember compat prebuild failed'))));
    });
    return prebuildPromise;
  }

  prebuildPromise = new Promise<void>((resolve, reject) => {
    const child = fork(
      emberCLI,
      ['build', '--watch', '--environment', mode, '-o', 'tmp/compat-prebuild', '--suppress-sizes'],
      // `detached: true` makes the child its own process-group leader so we can
      // later kill the *whole* tree (ember-cli forks broccoli watchers / sane /
      // a shell). Without this, `child.kill()` only signals the ember node
      // process and the watcher grandchildren are orphaned -> `webpack serve`
      // never finishes shutting down and CI hangs until the job is killed.
      { silent: true, env, detached: process.platform !== 'win32' }
    );
    watchChild = child;
    registerProcessCleanup();
    child.on('exit', code => {
      if (code !== 0) {
        reject(new Error('ember compat prebuild (--watch) failed'));
      }
    });
    child.on('spawn', () => {
      child.stderr?.on('data', data => {
        console.error(data.toString());
      });
      child.stdout?.on('data', data => {
        let str = data.toString();
        console.log(str);
        // resolves the first time; on subsequent incremental builds the gate
        // is already resolved and the fresh output simply triggers a webpack
        // rebuild via the watched working dir.
        if (str.includes('Build successful')) {
          resolve();
        }
      });
    });
  });
  return prebuildPromise;
}

// Tear down the long-lived `ember build --watch` child (and its broccoli /
// sane / shell descendants) when webpack stops. We SIGKILL the whole process
// group so this returns immediately and never blocks the dev server's
// shutdown (a graceful SIGTERM lets ember-cli's watchers linger long enough
// that CI times out).
export function stopCompatPrebuild(): void {
  let child = watchChild;
  watchChild = undefined;
  prebuildPromise = undefined;
  if (!child) {
    return;
  }
  try {
    if (process.platform !== 'win32' && typeof child.pid === 'number') {
      // negative pid => the whole process group (child was spawned detached)
      process.kill(-child.pid, 'SIGKILL');
    } else {
      child.kill('SIGKILL');
    }
  } catch {
    // already gone (ESRCH) or not permitted; nothing more to do
  }
}

// A webpack plugin so the prebuild is sequenced (and its logs flushed) before
// the rest of compilation. The async `entry` function also awaits
// `runCompatPrebuild`, so the prebuild is guaranteed complete before any
// resolution happens regardless of plugin ordering.
export function compatPrebuild(mode: string, resolvableExtensions: string[] | undefined) {
  return {
    apply(compiler: Compiler) {
      const appRoot = (compiler.options.context as string) || process.cwd();

      const oneShot = (_compiler: unknown, callback: (err?: Error) => void) => {
        runCompatPrebuild(mode, resolvableExtensions, false).then(
          () => callback(),
          err => callback(err)
        );
      };
      const watching = (_compiler: unknown, callback: (err?: Error) => void) => {
        runCompatPrebuild(mode, resolvableExtensions, true).then(
          () => callback(),
          err => callback(err)
        );
      };
      // `run()` (one-shot `webpack build`) fires beforeRun; `watch()`
      // (`webpack serve` / `webpack --watch`) fires watchRun. Each picks the
      // matching prebuild flavor; whichever fires first wins the memoized gate.
      compiler.hooks.beforeRun.tapAsync('embroider-compat-prebuild', oneShot);
      compiler.hooks.watchRun.tapAsync('embroider-compat-prebuild', watching);

      // Make webpack watch the prebuild outputs so that when the
      // `ember build --watch` child regenerates them, webpack rebuilds. This
      // is the webpack analog of vite watching the prebuild working dir.
      const workingDir = locateEmbroiderWorkingDir(appRoot);
      const prebuildOut = join(appRoot, 'tmp', 'compat-prebuild');
      compiler.hooks.afterCompile.tap('embroider-compat-prebuild', compilation => {
        compilation.contextDependencies.add(workingDir);
        compilation.contextDependencies.add(prebuildOut);
      });

      compiler.hooks.watchClose.tap('embroider-compat-prebuild', stopCompatPrebuild);
      compiler.hooks.shutdown.tap('embroider-compat-prebuild', stopCompatPrebuild);
    },
  };
}
