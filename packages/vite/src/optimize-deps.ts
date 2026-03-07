import { esBuildResolver } from './esbuild-resolver.js';

export interface OptimizeDeps {
  [key: string]: unknown;
}

export function optimizeDeps(): OptimizeDeps {
  return {
    extensions: ['.hbs', '.gjs', '.gts'],
    esbuildOptions: {
      plugins: [esBuildResolver()],
    },
  };
}
