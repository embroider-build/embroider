import path from 'node:path';
import url from 'node:url';
import fs from 'node:fs';

import { defineConfig } from 'rollup';
import autoExternal from 'rollup-plugin-auto-external';
import swc from 'rollup-plugin-swc3';

const __dirname = url.fileURLToPath(new URL('.', import.meta.url));
const repoRoot = path.join(__dirname, '../../../');
const rootTsConfig = path.join(repoRoot, 'tsconfig.json');

/**
 * @param {ImportMeta} meta
 * @param {import('./types').Options} options
 */
export function rollupConfig(meta, options) {
  let callerUrl = new URL('.', meta.url);
  let callerDir = url.fileURLToPath(callerUrl);
  let localTsConfig = path.join(callerDir, 'tsconfig.json');

  let tsconfig = fs.existsSync(localTsConfig) ? localTsConfig : rootTsConfig;

  let dist = options.distDir ?? 'dist';
  let src = options.srcDir ?? 'src';
  let distDir = path.join(callerDir, dist);
  let srcDir = path.join(callerDir, src);

  let input = options.publicEntrypoints.map(entry => {
    return path.join(srcDir, entry);
  });

  const swcCompiler = swc({
    tsconfig: rootTsConfig,
    sourceMaps: true,
    jsc: {
      parser: {
        sourceMap: 'inline',
        syntax: 'typescript',
        tsx: false,
        decorators: true,
        dynamicImport: true,
      },
      target: 'esnext',
    },
  });

  return defineConfig([
    {
      input,
      output: {
        format: 'cjs',
        sourcemap: true,
        dir: path.join(distDir, 'cjs'),
      },
      plugins: [
        swcCompiler,
        autoExternal({
          packagePath: path.join(callerDir, 'package.json'),
        }),
      ],
    },
    {
      input,
      output: {
        format: 'esm',
        sourcemap: true,
        dir: path.join(distDir, 'esm'),
      },
      plugins: [
        swcCompiler,
        autoExternal({
          packagePath: path.join(callerDir, 'package.json'),
        }),
      ],
    },
  ]);
}
