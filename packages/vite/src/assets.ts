import type { Resolver } from '@embroider/core';
import core from '@embroider/core';
const { ResolverLoader } = core;
import type { Plugin } from 'vite';
import * as process from 'process';
import { join, posix } from 'path';
import fs from 'fs-extra';
const { existsSync, readFileSync, lstatSync } = fs;
import send from 'send';

function findPublicAsset(relativePath: string, resolver: Resolver) {
  const packageCache = resolver.packageCache;
  let pkg = packageCache.ownerOfFile(relativePath);

  for (const engine of resolver.options.engines) {
    for (const addon of engine.activeAddons) {
      pkg = packageCache.ownerOfFile(addon.root);
      if (pkg && pkg.meta && pkg.isV2Addon() && pkg.meta['public-assets']) {
        const asset = Object.entries(pkg.meta['public-assets']).find(
          ([_key, a]) => posix.resolve('/', a) === relativePath
        )?.[0];
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
    configResolved(options) {
      mode = options.command;
      publicDir = options.publicDir;
    },
    configureServer(server) {
      return () => {
        server.middlewares.use((req, res, next) => {
          if (req.originalUrl && req.originalUrl.length > 1) {
            const assetUrl = findPublicAsset(req.originalUrl.split('?')[0], resolverLoader.resolver);
            if (assetUrl) {
              return send(req, assetUrl).pipe(res as unknown as NodeJS.WritableStream);
            }
          }
          return next();
        });
      };
    },
    buildStart: {
      // we need to wait for the compatBuild plugin's buildStart hook to finish
      // so that the resolver config exists before we try to read it.
      sequential: true,
      order: 'post',
      async handler() {
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

              const filePath = join(pkg.root, path);
              if (!lstatSync(filePath).isFile()) {
                console.log(`Invalid package definition, ${pkg.name} has defined a file "${path}" that is not a file`);
                return;
              }

              this.emitFile({
                type: 'asset',
                source: readFileSync(filePath),
                fileName: posix.resolve('/', dest).slice(1),
              });
            });
          });
        }
      },
    },
  };
}
