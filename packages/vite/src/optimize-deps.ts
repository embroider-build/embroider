import { esBuildResolver } from './esbuild-resolver';
import { ResolverLoader } from '@embroider/core';

export interface OptimizeDeps {
  exclude?: string[];
  [key: string]: unknown;
}

export function optimizeDeps(): OptimizeDeps {
  let resolverLoader = new ResolverLoader(process.cwd());

  const res = {
    extensions: ['.hbs', '.gjs', '.gts'],
    esbuildOptions: {
      plugins: [esBuildResolver()],
    },
  };

  Object.defineProperty(res, 'exclude', {
    get() {
      const addons: string[] = [];
      for (const engine of resolverLoader.resolver.options.engines) {
        for (const activeAddon of engine.activeAddons) {
          const pkg = resolverLoader.resolver.packageCache.get(activeAddon.root);
          if (pkg.isV2Addon() && pkg.meta['is-dynamic']) {
            addons.push(pkg.name);
          }
        }
      }
      return ['@embroider/macros', ...addons];
    },
  });
  
  return res;
}
