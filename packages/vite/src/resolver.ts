import type { PluginContext, ResolveIdResult } from 'rollup';
import type { Plugin } from 'vite';
import { join } from 'path/posix';
import type { Resolution, ResolverFunction } from '@embroider/core';
import { ResolverLoader, virtualContent } from '@embroider/core';
import { RollupModuleRequest, virtualPrefix } from './request';
import assertNever from 'assert-never';

type Options = {
  entryFolders: string[];
};

export function resolver(_options?: Options): Plugin {
  const resolverLoader = new ResolverLoader(process.cwd());
  resolverLoader.resolver.options.environment = 'production';
  return {
    name: 'embroider-resolver',
    enforce: 'pre',
    configureServer() {
      resolverLoader.resolver.options.environment = 'development';
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
        return virtualContent(id.slice(virtualPrefix.length), resolverLoader.resolver);
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
