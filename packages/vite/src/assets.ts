import type { Resolver } from '@embroider/core';
import { ResolverLoader } from '@embroider/core';
import type { Plugin } from 'vite';
import * as process from 'process';
import { join } from 'path';
import { existsSync, readFileSync } from 'fs-extra';
import send from 'send';
import type { Readable } from 'stream';

function findPublicAsset(relativePath: string, resolver: Resolver) {
  const packageCache = resolver.packageCache;
  let pkg = packageCache.ownerOfFile(relativePath);

  for (const engine of resolver.options.engines) {
    for (const addon of engine.activeAddons) {
      pkg = packageCache.ownerOfFile(addon.root);
      if (pkg && pkg.meta && pkg.isV2Addon() && pkg.meta['public-assets']) {
        const asset = Object.entries(pkg.meta['public-assets']).find(([_key, a]) => a === relativePath)?.[0];
        let local = asset ? join(addon.root, asset) : null;
        if (local && existsSync(local)) {
          return local;
        }
      }
    }
  }
}

export function assets(): Plugin {
  const cwd = process.cwd();
  const resolverLoader = new ResolverLoader(cwd);
  let mode: 'build' | 'serve' = 'build';
  let publicDir = 'public';
  return {
    name: 'assets',
    enforce: 'post',
    configureServer(server) {
      mode = server.config.command;
      publicDir = server.config.publicDir;
      return () => {
        server.middlewares.use((req, res, next) => {
          if (req.originalUrl && req.originalUrl.length > 1) {
            const assetUrl = findPublicAsset(req.originalUrl.split('?')[0], resolverLoader.resolver);
            if (assetUrl) {
              return send(req as Readable, assetUrl).pipe(res);
            }
          }
          return next();
        });
      };
    },
    async buildStart() {
      if (mode !== 'build') return;
      const engines = resolverLoader.resolver.options.engines;
      for (const engine of engines) {
        const packages = engine.activeAddons.map(a => resolverLoader.resolver.packageCache.ownerOfFile(a.root));
        packages.forEach(pkg => {
          if (!pkg || !pkg.isV2Addon()) return;
          const assets = pkg.meta['public-assets'] || {};
          Object.entries(assets).forEach(([path, dest]) => {
            // do not override app public assets
            if (existsSync(join(publicDir, dest))) {
              return;
            }
            this.emitFile({
              type: 'asset',
              source: readFileSync(join(pkg.root, path)),
              fileName: dest.slice(1),
            });
          });
        });
      }
    },
  };
}
