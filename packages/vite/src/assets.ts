import type { Resolver } from '@embroider/core';
import { getAppMeta, locateEmbroiderWorkingDir, ResolverLoader, virtualContent } from '@embroider/core';
import { join } from 'path/posix';
import { existsSync } from 'fs';
import CompatApp from '@embroider/compat/src/compat-app';
import type { Plugin } from 'vite';
import * as process from 'process';
import { RollupModuleRequest, virtualPrefix } from './request';

// type Options = {
//   root: string;
//   compatAppDir?: string;
//   rewrittenPackageCache: RewrittenPackageCache;
// };

let InMemoryAssets: Record<string, string> = {};

let environment: 'production' | 'development' = 'production';
//
// async function generateHtml(root: string, appOrTest: 'app' | 'test') {
//   const file = appOrTest === 'app' ? 'index.html' : 'tests/index.html';
//   if (!InMemoryAssets[file]) {
//     InMemoryAssets[file] = await CompatApp.getCachedBuilderInstance(process.cwd()).rebuildHtml(
//       root,
//       environment,
//       appOrTest
//     );
//   }
//
//   return InMemoryAssets[file];
// }
//
// async function generateAppEntries({ rewrittenPackageCache, root }: Options) {
//   const pkg = rewrittenPackageCache.get(process.cwd());
//   if (!InMemoryAssets[`assets/${pkg.name}.js`]) {
//     InMemoryAssets[`assets/${pkg.name}.js`] = await CompatApp.getCachedBuilderInstance(process.cwd()).rebuildEntryFile(
//       root
//     );
//   }
//   return InMemoryAssets[`assets/${pkg.name}.js`];
// }
//
// async function generateTestEntries(testFolder: string) {
//   if (!InMemoryAssets[`assets/test.js`]) {
//     InMemoryAssets[`assets/test.js`] = await CompatApp.getCachedBuilderInstance(process.cwd()).rebuildEntryFile(
//       testFolder
//     );
//   }
//   return InMemoryAssets[`assets/test.js`];
// }

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

export function assets(options?: { entryDirectories?: string[] }): Plugin {
  const cwd = process.cwd();
  const root = join(cwd, 'app');
  const embroiderWorkingDir = locateEmbroiderWorkingDir(cwd);
  const resolverLoader = new ResolverLoader(cwd);
  resolverLoader.resolver.options.environment = environment;
  const appMeta = getAppMeta(cwd);
  const tests = join(cwd, 'tests');
  const appIndex = join(cwd, 'index.html');
  const config = join(cwd, 'config', 'environment.js');
  const testsIndex = join(tests, 'index.html');

  const entries = ['routes', 'templates', 'controllers'].concat(options?.entryDirectories || []);

  return {
    name: 'assets',
    enforce: 'pre',
    configureServer(server) {
      environment = 'development';
      resolverLoader.resolver.options.environment = environment;
      const watcher = server.watcher;
      // this is required because we do not open the /tests url directly and via the middleware
      watcher.on('add', filename => {
        if (entries.find(e => filename.startsWith(join(root, e)))) {
          delete InMemoryAssets[`assets/${appMeta.name}.js`];
          const module = server.moduleGraph.getModuleById(join(root, `assets/${appMeta.name}.js`))!;
          server.moduleGraph.invalidateModule(module);
        }
        if (filename.startsWith('tests/')) {
          delete InMemoryAssets[`assets/test.js`];
        }
      });
      watcher.on('unlink', filename => {
        if (entries.find(e => filename.startsWith(join(root, e)))) {
          delete InMemoryAssets[`assets/${appMeta.name}.js`];
        }
        if (filename.startsWith(tests)) {
          delete InMemoryAssets[`assets/test.js`];
        }
      });
      watcher.on('change', filename => {
        if (appIndex === filename) {
          delete InMemoryAssets['index.html'];
        }
        if (testsIndex === filename) {
          delete InMemoryAssets['tests/index.html'];
          server.ws.send({
            type: 'full-reload',
          });
        }
        if (filename === config) {
          delete InMemoryAssets['index.html'];
          delete InMemoryAssets['tests/index.html'];
          server.ws.send({
            type: 'full-reload',
          });
        }
      });
      server.middlewares.use((req, _res, next) => {
        // this is necessary so that /tests will load tests/index
        // otherwise this would only happen when /tests/ or /tests/index.html is opened
        if (req.originalUrl?.match(/\/tests($|\?)/)) {
          req.originalUrl = '/tests/index.html';
          (req as any).url = '/tests/index.html';
          return next();
        }
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
      async handler(_html, ctx) {
        const request = RollupModuleRequest.from(ctx.filename, '<stdin>', {})!;
        const resolution = resolverLoader.resolver.resolveSync(request, (req) => ({ type: 'found', result: req.specifier }));
        if (resolution.result.startsWith(virtualPrefix)) {
          return virtualContent(resolution.result.slice(virtualPrefix.length), resolverLoader.resolver);
        }
      },
    },
    async writeBundle(options) {
      await CompatApp.getCachedBuilderInstance(root).copyPublicAssetsToDir(options.dir || join(cwd, 'dist'));
    },
  };
}
