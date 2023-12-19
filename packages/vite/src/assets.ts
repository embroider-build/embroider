import type { Resolver } from '@embroider/core';
import { ResolverLoader } from '@embroider/core';
import type { Plugin } from 'vite';
import * as process from 'process';
import { join } from 'path';
import { existsSync, readFileSync } from 'fs-extra';
import glob from 'fast-glob';
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
  return {
    name: 'assets',
    enforce: 'post',
    configureServer(server) {
      mode = server.config.command;
      server.middlewares.use((req, res, next) => {
        if (req.originalUrl?.includes('?')) {
          return next();
        }
        if (req.originalUrl && req.originalUrl.length > 1) {
          const assetUrl = findPublicAsset(req.originalUrl, resolverLoader.resolver);
          if (assetUrl) {
            return send(req as Readable, assetUrl).pipe(res);
          }
        }
        return next();
      });
    },
    async buildStart() {
      if (mode !== 'build') return;
      const engines = resolverLoader.resolver.options.engines;
      for (const engine of engines) {
        engine.activeAddons.forEach(addon => {
          const pkg = resolverLoader.resolver.packageCache.ownerOfFile(addon.root);
          if (!pkg || !pkg.isV2Addon()) return;
          const assets = pkg.meta['public-assets'] || {};
          Object.entries(assets).forEach(([path, dest]) => {
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
