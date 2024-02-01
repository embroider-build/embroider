import { esBuildResolver } from './esbuild-resolver';

export interface OptimizeDeps {
  exclude?: string[];
  [key: string]: unknown;
}

export function optimizeDeps(): OptimizeDeps {
  return {
    exclude: ['@embroider/macros'],
    extensions: ['.hbs', '.gjs', '.gts'],
    esbuildOptions: {
      plugins: [esBuildResolver()],
      resolveExtensions: ['.js', '.ts', '.gjs', '.gts'],
    },
  };
}
