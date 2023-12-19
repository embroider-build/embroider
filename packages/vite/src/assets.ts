import { ResolverLoader } from '@embroider/core';
import type { Plugin } from 'vite';
import * as process from 'process';
import { dirname, join } from 'path';
import { copyFileSync, mkdirpSync } from 'fs-extra';
import glob from 'fast-glob';

export function assets(): Plugin {
  const cwd = process.cwd();
  const resolverLoader = new ResolverLoader(cwd);
  return {
    name: 'assets',
    enforce: 'pre',
    outputOptions(options) {
      options.dir = join(process.cwd(), 'dist');
    },
    async writeBundle(options) {
      const engines = resolverLoader.resolver.options.engines;
      const pubDir = join(process.cwd(), 'public');
      const publicAppFiles = glob.sync('**/*', {
        cwd: pubDir,
      });
      for (const publicAppFile of publicAppFiles) {
        mkdirpSync(dirname(join(options.dir!, publicAppFile)));
        copyFileSync(join(pubDir, publicAppFile), join(options.dir!, publicAppFile));
      }
      for (const engine of engines) {
        engine.activeAddons.forEach(addon => {
          const pkg = resolverLoader.resolver.packageCache.ownerOfFile(addon.root);
          if (!pkg || !pkg.isV2Addon()) return;
          const assets = pkg.meta['public-assets'] || {};
          Object.entries(assets).forEach(([path, dest]) => {
            mkdirpSync(dirname(join(options.dir!, dest)));
            copyFileSync(join(pkg.root, path), join(options.dir!, dest));
          });
        });
      }
    },
  };
}
