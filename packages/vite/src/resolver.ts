import type { Plugin, ViteDevServer } from 'vite';
import { virtualContent, ResolverLoader } from '@embroider/core';
import { RollupModuleRequest, virtualPrefix } from './request';
import assertNever from 'assert-never';
import makeDebug from 'debug';
import { resolve } from 'path';
import { writeStatus } from './esbuild-request';
import { PluginContext } from 'rollup';

const debug = makeDebug('embroider:vite');

export function resolver(): Plugin {
  let resolverLoader = new ResolverLoader(process.cwd());
  let server: ViteDevServer;
  let virtualDeps: Map<string, string[]> = new Map();

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
      if (options.custom?.depScan) {
        return await observeDepScan(this, source, importer, options);
      }

      let request = RollupModuleRequest.from(this, source, importer, options.custom);
      if (!request) {
        // fallthrough to other rollup plugins
        return null;
      }
      let resolution = await resolverLoader.resolver.resolve(request);
      switch (resolution.type) {
        case 'found':
        case 'ignored':
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

// During depscan, we have a wildly different job than during normal
// usage. Embroider's esbuild resolver plugin replaces this rollup
// resolver plugin for actually doing resolving, so we don't do any of
// that. But we are still well-positioned to observe what vite's rollup
// resolver plugin is doing, and that is important because vite's
// esbuild depscan plugin will always obscure the results before
// embroider's esbuild resolver plugin can see them. It obscures the
// results by marking *both* "not found" and "this is a third-party
// package" as "external: true". We really care about the difference
// between the two, since we have fallback behaviors that should apply
// to "not found" that should not apply to successfully discovered
// third-party packages.
async function observeDepScan(context: PluginContext, source: string, importer: string | undefined, options: any) {
  let result = await context.resolve(source, importer, {
    ...options,
    skipSelf: true,
  });
  writeStatus(source, result ? 'found' : 'not_found');
  return result;
}
