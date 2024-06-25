import { esBuildResolver } from './esbuild-resolver';

export interface OptimizeDeps {
  exclude?: string[];
  [key: string]: unknown;
}

export function optimizeDeps(): OptimizeDeps {
  return {
    disabled: true,
    exclude: ['@embroider/macros'],
    extensions: ['.hbs', '.gjs', '.gts'],
    esbuildOptions: {
      plugins: [esBuildResolver()],
    },
  };
}
