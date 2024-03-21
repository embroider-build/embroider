import { esBuildResolver } from './esbuild-resolver';

export interface OptimizeDeps {
  exclude?: string[];
  [key: string]: unknown;
}

export function optimizeDeps(options: OptimizeDeps): OptimizeDeps {
  return {
    ...options,
    exclude: ['@embroider/macros', ...(options.exclude || [])],
    extensions: ['.hbs', '.gjs', '.gts'],
    esbuildOptions: {
      plugins: [esBuildResolver()],
    },
  };
}
