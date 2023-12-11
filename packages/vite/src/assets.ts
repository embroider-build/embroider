import type { RewrittenPackageCache, Resolver } from '@embroider/core';
import { getAppMeta, locateEmbroiderWorkingDir, ResolverLoader } from '@embroider/core';
import { join } from 'path/posix';
import { existsSync, readFileSync } from 'fs';
import CompatApp from '@embroider/compat/src/compat-app';
import type { Plugin } from 'vite';
import * as process from 'process';

type Options = {
  root: string;
  compatAppDir?: string;
  rewrittenPackageCache: RewrittenPackageCache;
};

let InMemoryAssets: Record<string, string> = {};

let environment: 'production' | 'development' = 'production';

async function generateHtml(root: string, appOrTest: 'app' | 'test') {
  const file = appOrTest === 'app' ? 'index.html' : 'tests/index.html';
  if (!InMemoryAssets[file]) {
    InMemoryAssets[file] = await CompatApp.getCachedBuilderInstance(process.cwd()).rebuildHtml(
      root,
      environment,
      appOrTest
    );
  }

  return InMemoryAssets[file];
}

async function generateAppEntries({ rewrittenPackageCache, root }: Options) {
  const pkg = rewrittenPackageCache.get(root);
  if (!InMemoryAssets[`assets/${pkg.name}.js`]) {
    InMemoryAssets[`assets/${pkg.name}.js`] = await CompatApp.getCachedBuilderInstance(process.cwd()).rebuildEntryFile(
      root
    );
  }
  return InMemoryAssets[`assets/${pkg.name}.js`];
}

async function generateTestEntries(testFolder: string) {
  if (!InMemoryAssets[`assets/test.js`]) {
    InMemoryAssets[`assets/test.js`] = await CompatApp.getCachedBuilderInstance(process.cwd()).rebuildEntryFile(
      testFolder
    );
  }
  return InMemoryAssets[`assets/test.js`];
}

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
  const rewrittenApp = join(embroiderWorkingDir, 'rewritten-app');
  const resolverLoader = new ResolverLoader(cwd);
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
          const module = server.moduleGraph.getModuleById(config)!;
          server.moduleGraph.invalidateModule(module);
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
        if (ctx.filename === appIndex) {
          return await generateHtml(root, 'app');
        }
        if (ctx.filename === testsIndex) {
          return await generateHtml(root, 'test');
        }
      },
    },
    load(id) {
      id = id.split('?')[0];
      if (id.endsWith('/testem.js')) {
        return '';
      }
      if (id === join(cwd, 'config', 'environment.js')) {
        const code = readFileSync(id).toString();
        return code.replace('module.exports = ', 'export default ');
      }
      if (id.startsWith(root + '/assets/')) {
        if (id.endsWith(appMeta.name + '.js')) {
          return generateAppEntries({
            root,
            rewrittenPackageCache: resolverLoader.resolver.packageCache,
          });
        }
        if (id.endsWith('/assets/test.js')) {
          return generateTestEntries(tests);
        }
        return readFileSync(rewrittenApp + id.replace(root + '/assets/', '/assets/').split('?')[0]).toString();
      }
    },
    async writeBundle(options) {
      await CompatApp.getCachedBuilderInstance(root).copyPublicAssetsToDir(options.dir || join(cwd, 'dist'));
    },
  };
}
