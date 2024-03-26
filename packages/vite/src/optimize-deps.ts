import { esBuildResolver } from './esbuild-resolver';
import { ResolverLoader } from '@embroider/core';

export interface OptimizeDeps {
  exclude?: string[];
  [key: string]: unknown;
}

type EmberOpts = {
  excludeLegacyAddons?: string[];
};

let resolverLoader = new ResolverLoader(process.cwd());

export function optimizeDeps(options?: OptimizeDeps, { excludeLegacyAddons }: EmberOpts = {}): OptimizeDeps {
  resolverLoader.sharedConfig.excludeLegacyAddons = excludeLegacyAddons;
  return {
    ...options,
    exclude: ['@embroider/macros', ...(options?.exclude || [])],
    extensions: ['.hbs', '.gjs', '.gts'],
    esbuildOptions: {
      plugins: [esBuildResolver()],
    },
  };
}
