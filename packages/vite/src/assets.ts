import type { Resolver } from '@embroider/core';
import { locateEmbroiderWorkingDir, ResolverLoader } from '@embroider/core';
import { join, resolve } from 'path';
import { existsSync, readFileSync } from 'fs';
import type { Plugin } from 'vite';
import { normalizePath } from 'vite';

function findPublicAsset(relativePath: string, resolver: Resolver, embroiderWorkingDir: string) {
  const packageCache = resolver.packageCache;
  const cwd = process.cwd();
  const publicDir = join(cwd, 'public');
  // check public path
  let pkg = packageCache.ownerOfFile(relativePath);
  let p = join(publicDir, relativePath);
  if (pkg && pkg.isV2App() && existsSync(p)) {
    return relativePath;
  }

  for (const engine of resolver.options.engines) {
    for (const addon of engine.activeAddons) {
      pkg = packageCache.ownerOfFile(addon.root);
      if (pkg && pkg.meta && pkg.isV2Addon() && pkg.meta['public-assets']) {
        const asset = Object.entries(pkg.meta['public-assets']).find(([_key, a]) => a === relativePath)?.[0];
        let local = asset ? join(addon.root, asset) : null;
        if (local && !local.includes(embroiderWorkingDir) && asset) {
          // remap to local path without symlinks so vite can find it
          const localNodeModulePath = normalizePath(local).split('/node_modules/').slice(-1)[0]!;
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
  const embroiderWorkingDir = locateEmbroiderWorkingDir(cwd);
  const tests = join('.', 'tests');
  const embroiderDir = join(cwd, 'node_modules', '.embroider');
  const rewrittenApp = join(embroiderDir, 'rewritten-app');
  const appIndex = resolve('.', 'index.html').replace(/\\/g, '/');
  const testsIndex = resolve(tests, 'index.html').replace(/\\/g, '/');
  const rewrittenAppIndex = resolve(rewrittenApp, 'index.html').replace(/\\/g, '/');
  const rewrittenTestIndex = resolve(rewrittenApp, 'tests', 'index.html').replace(/\\/g, '/');

  const resolverLoader = new ResolverLoader(cwd);

  return {
    name: 'assets',
    enforce: 'pre',
    async resolveId(source, importer, options) {
      // make assets resolve locally instead of root /
      if (source.startsWith('/assets/')) {
        return source.slice(1);
      }
      if (importer?.startsWith('assets/') && source.startsWith('.')) {
        if (source.startsWith('./')) {
          return join('assets', source);
        }
        if (source === '../app') {
          // app is now under app folder
          return this.resolve(join(cwd, 'app', 'app'), importer, { ...options, skipSelf: true });
        }
        // dirname does not work well between posix and win32, just do relative path ..
        return this.resolve(join(importer, '..', source), importer, { ...options, skipSelf: true });
      }
    },
    async load(id) {
      if (id.startsWith('assets/')) {
        return readFileSync(join(rewrittenApp, id.split('?')[0])).toString();
      }
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
          return next();
        }
        return next();
      });
    },
    transformIndexHtml: {
      order: 'pre',
      handler(_html, ctx) {
        if (ctx.filename === appIndex) {
          return readFileSync(rewrittenAppIndex).toString();
        }
        if (ctx.filename === testsIndex) {
          return readFileSync(rewrittenTestIndex).toString();
        }
      },
    },
  };
}
