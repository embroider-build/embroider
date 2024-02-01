import type { PluginContext, ResolveIdResult } from 'rollup';
import type { Plugin, ViteDevServer } from 'vite';
import type { Resolution, ResolverFunction } from '@embroider/core';
import { virtualContent, ResolverLoader } from '@embroider/core';
import { RollupModuleRequest, virtualPrefix } from './request';
import assertNever from 'assert-never';
import makeDebug from 'debug';

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
      let request = RollupModuleRequest.from(source, importer, options.custom);
      if (!request) {
        // fallthrough to other rollup plugins
        return null;
      }
      let resolution = await resolverLoader.resolver.resolve(request, defaultResolve(this));
      switch (resolution.type) {
        case 'found':
          return resolution.result;
        case 'not_found':
          return null;
        default:
          throw assertNever(resolution);
      }
    },
    load(id) {
      if (id.startsWith(virtualPrefix)) {
        let { src, watches } = virtualContent(id.slice(virtualPrefix.length), resolverLoader.resolver);
        virtualDeps.set(id, watches);
        server.watcher.add(watches);
        return src;
      }
    },
  };
}

function defaultResolve(context: PluginContext): ResolverFunction<RollupModuleRequest, Resolution<ResolveIdResult>> {
  return async (request: RollupModuleRequest) => {
    if (request.isVirtual) {
      return {
        type: 'found',
        result: { id: request.specifier, resolvedBy: request.fromFile },
      };
    }
    if (request.isNotFound) {
      // TODO: we can make sure this looks correct in rollup & vite output when a
      // user encounters it
      let err = new Error(`module not found ${request.specifier}`);
      (err as any).code = 'MODULE_NOT_FOUND';
      return { type: 'not_found', err };
    }
    let result = await context.resolve(request.specifier, request.fromFile, {
      skipSelf: true,
      custom: {
        embroider: {
          enableCustomResolver: false,
          meta: request.meta,
        },
      },
    });
    if (result) {
      return { type: 'found', result };
    } else {
      return { type: 'not_found', err: undefined };
    }
  };
}
