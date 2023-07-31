// @ts-check
import path from 'node:path';
import url from 'node:url';

import { defineConfig } from 'rollup';
import typescript from '@rollup/plugin-typescript';
import multi from '@rollup/plugin-multi-entry';
import { default as clean } from 'rollup-plugin-delete';
import autoExternal from 'rollup-plugin-auto-external';

const __dirname = url.fileURLToPath(new URL('.', import.meta.url));
const repoRoot = path.join(__dirname, '../../../');
const tsconfig = path.join(repoRoot, 'tsconfig.json');

/**
 * @param {ImportMeta} meta
 * @param {import('./types').Options} options
 */
export function rollupConfig(meta, options) {
  let callerUrl = new URL('.', meta.url);
  let callerDir = url.fileURLToPath(callerUrl);

  let dist = options.distDir ?? 'dist';
  let src = options.srcDir ?? 'src';
  let destDir = path.join(callerDir, dist);
  let srcDir = path.join(callerDir, src);

  let input = options.publicEntrypoints.map(entry => {
    return path.join(srcDir, entry);
  });

  return defineConfig({
    input,
    output: [
      {
        format: 'cjs',
      },
      {
        format: 'esm',
      },
    ],
    plugins: [
      multi(),
      typescript({
        tsconfig,
      }),
      // autoExternal({
      //   packagePath: path.join(callerDir, 'package.json'),
      // }),

      clean({ targets: `${destDir}/*` }),
    ],
  });
}
