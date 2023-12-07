import { esBuildResolver } from './esbuild-resolver';
import { addons } from './addons';

export interface OptimizeDeps {
  exclude?: string[];
  [key: string]: unknown;
}

export function optimizeDeps(root: string): OptimizeDeps {
  return {
    exclude: [
      '@embroider/macros',
      ...addons(root)
    ],
    extensions: ['.hbs', '.gjs'],
    esbuildOptions: {
      plugins: [esBuildResolver()],
    },
  };
}
