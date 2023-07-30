import path from 'path';
import { defineConfig } from 'rollup';

import { default as clean } from 'rollup-plugin-delete';

export function rollupConfig(meta) {
  let callerDir = new URL('.', meta.url);
  let destDir = path.join(callerDir, 'dist');
  let srcDir = path.join(callerDir, 'src');

  return defineConfig({
    input: srcDir,
    output: [
      {
        format: 'cjs',
      },
      {
        format: 'esm',
      },
    ],
    plugins: [clean({ targets: `${destDir}/*` })],
  });
}
