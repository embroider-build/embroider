import type { Resolver } from '@embroider/core';
import { ResolverLoader, locateEmbroiderWorkingDir } from '@embroider/core';
import type { Plugin } from 'vite';
import * as process from 'process';
import { dirname, join } from 'path';
import { copyFileSync, mkdirpSync, existsSync } from 'fs-extra';
import glob from 'fast-glob';

function findPublicAsset(relativePath: string, resolver: Resolver, embroiderWorkingDir: string) {
  const packageCache = resolver.packageCache;
  const cwd = process.cwd();
  const publicDir = join(cwd, 'public');
  // check public path
  let pkg = packageCache.ownerOfFile(relativePath);
  let p = join(publicDir, relativePath);
  if (pkg && pkg.isV2App() && existsSync(p)) {
    return '/' + p;
  }

  for (const engine of resolver.options.engines) {
    for (const addon of engine.activeAddons) {
      pkg = packageCache.ownerOfFile(addon.root);
      if (pkg && pkg.meta && pkg.isV2Addon() && pkg.meta['public-assets']) {
        const asset = Object.entries(pkg.meta['public-assets']).find(([_key, a]) => a === relativePath)?.[0];
        let local = asset ? join(addon.root, asset) : null;
        if (!local?.includes(embroiderWorkingDir) && asset) {
          // remap to local path without symlinks so vite can find it
          const localNodeModulePath = local?.split('/node_modules/').slice(-1)[0]!;
          local = join('node_modules', localNodeModulePath);
        }
        if (local && existsSync(local)) {
          return '/' + local;
        }
      }
    }
  }
}

export function assets(): Plugin {
  const cwd = process.cwd();
  const resolverLoader = new ResolverLoader(cwd);
  const embroiderWorkingDir = locateEmbroiderWorkingDir(cwd);
  return {
    name: 'assets',
    enforce: 'pre',
    outputOptions(options) {
      options.dir = join(process.cwd(), 'dist');
    },
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (req.originalUrl?.includes('?')) {
          return next();
        }
        if (req.originalUrl && req.originalUrl.length > 1) {
          const newUrl = findPublicAsset(req.originalUrl, resolverLoader.resolver, embroiderWorkingDir);
          if (newUrl) {
            req.originalUrl = newUrl;
            (req as any).url = newUrl;
          }
        }
        return next();
      });
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
