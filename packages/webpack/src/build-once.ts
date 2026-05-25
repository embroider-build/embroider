import { spawn } from 'child_process';

// The webpack equivalent of vite's `buildOnce`. It is passed to `compatBuild`
// in the app's ember-cli-build.js so that classic `ember build` / `ember test`
// invocations delegate the actual bundling to webpack, writing into the
// broccoli-provided outputPath.
export function buildOnce(outputPath: string, emberEnv: 'development' | 'test' | 'production'): Promise<void> {
  let webpackCli = require.resolve('webpack-cli/bin/cli.js', { paths: [process.cwd()] });
  let mode = emberEnv === 'production' ? 'production' : 'development';

  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [webpackCli, 'build', '--mode', mode], {
      cwd: process.cwd(),
      stdio: 'inherit',
      env: {
        ...process.env,
        EMBER_ENV: emberEnv,
        EMBROIDER_WEBPACK_OUTDIR: outputPath,
      },
    });
    child.on('exit', code => (code === 0 ? resolve() : reject(new Error('webpack build failed'))));
  });
}
