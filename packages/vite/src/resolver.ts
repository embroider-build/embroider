import type { Plugin, ViteDevServer } from 'vite';
import { virtualContent, ResolverLoader } from '@embroider/core';
import { RollupModuleRequest, virtualPrefix } from './request';
import assertNever from 'assert-never';
import makeDebug from 'debug';
import { resolve, join } from 'path';
import type { PartialResolvedId } from 'rollup';

const debug = makeDebug('embroider:vite');

export function resolver(): Plugin {
  let resolverLoader = new ResolverLoader(process.cwd());
  let server: ViteDevServer;
  let virtualDeps: Map<string, string[]> = new Map();
  let optimizedDeps: Map<string, string> = new Map();

  return {
    name: 'embroider-resolver',
    enforce: 'pre',

    configureServer(s) {
      server = s;
      server.watcher.on('all', (_eventName, path) => {
        for (let [id, watches] of virtualDeps) {
          for (let watch of watches) {
            if (path.startsWith(watch)) {
              debug('Invalidate %s because %s', id, path);
              server.moduleGraph.onFileChange(id);
              let m = server.moduleGraph.getModuleById(id);
              if (m) {
                server.reloadModule(m);
              }
            }
          }
        }
      });
    },

    async resolveId(source, importer, options) {
      let request = RollupModuleRequest.from(this, source, importer, options.custom);
      if (!request) {
        // fallthrough to other rollup plugins
        return null;
      }
      let alias = await resolverLoader.resolver.resolveAlias(request);
      if (request.fromFile && optimizedDeps.has(request.fromFile)) {
        request = request.rehome(join(optimizedDeps.get(request.fromFile)!, 'package.json'));
      }

      let resolution = await resolverLoader.resolver.resolve(request);
      switch (resolution.type) {
        case 'found':
        case 'ignored':
          let res = resolution.result as PartialResolvedId;
          if (res.id.includes('.vite/deps')) {
            let pkg = resolverLoader.resolver.packageCache.ownerOfFile(
              resolve('node_modules', alias.specifier.replace('@embroider', '.embroider'))
            );
            if (pkg) {
              pkg = resolverLoader.resolver.packageCache.maybeMoved(pkg) || pkg;
              optimizedDeps.set(res.id.split('?')[0], pkg.root);
            }
          }
          return resolution.result;
        case 'not_found':
          return null;
        default:
          throw assertNever(resolution);
      }
    },
    load(id) {
      if (id.startsWith(virtualPrefix)) {
        let { pathname } = new URL(id, 'http://example.com');
        let { src, watches } = virtualContent(pathname.slice(virtualPrefix.length + 1), resolverLoader.resolver);
        virtualDeps.set(id, watches);
        server?.watcher.add(watches);
        return src;
      }
    },
    buildEnd() {
      this.emitFile({
        type: 'asset',
        fileName: '@embroider/core/vendor.js',
        source: virtualContent(
          resolve(resolverLoader.resolver.options.engines[0].root, '-embroider-vendor.js'),
          resolverLoader.resolver
        ).src,
      });
      this.emitFile({
        type: 'asset',
        fileName: '@embroider/core/test-support.js',
        source: virtualContent(
          resolve(resolverLoader.resolver.options.engines[0].root, '-embroider-test-support.js'),
          resolverLoader.resolver
        ).src,
      });
    },
  };
}
