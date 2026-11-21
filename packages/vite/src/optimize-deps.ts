import { esBuildResolver } from './esbuild-resolver.js';

export interface OptimizeDeps {
  exclude?: string[];
  [key: string]: unknown;
}

export function optimizeDeps(): OptimizeDeps {
  return {
    exclude: ['@embroider/macros'],
    extensions: ['.hbs', '.gjs', '.gts'],
    esbuildOptions: {
      // When optimizing deps for development,
      // always allow the latest featuers
      // (such as top level await)
      target: 'esnext',
      plugins: [esBuildResolver()],
    },
  };
}
