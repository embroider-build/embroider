import type { PluginContext, ResolveIdResult } from 'rollup';
import type { Plugin } from 'vite';
import { join } from 'path/posix';
import type { Resolution, ResolverFunction } from '@embroider/core';
import { ResolverLoader, virtualContent } from '@embroider/core';
import { RollupModuleRequest, virtualPrefix } from './request';
import assertNever from 'assert-never';

const cwd = process.cwd();
const embroiderDir = join(cwd, 'node_modules', '.embroider');
const rewrittenApp = join(embroiderDir, 'rewritten-app');

type Options = {
  entryFolders: string[];
};

export function resolver(_options?: Options): Plugin {
  const resolverLoader = new ResolverLoader(process.cwd());
  resolverLoader.resolver.options.engines.forEach(engine => {
    engine.root = engine.root.replace(rewrittenApp, cwd);
    engine.activeAddons.forEach(addon => {
      addon.canResolveFromFile = addon.canResolveFromFile.replace(rewrittenApp, cwd);
    });
  });
  return {
    name: 'embroider-resolver',
    enforce: 'pre',
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
    let result = await context.resolve(request.specifier, request.fromFile, {
      skipSelf: true,
      custom: {
        embroider: {
          enableCustomResolver: false,
          meta: request.meta,
        },
      },
    });
    if (!result) {
      result = await context.resolve(
        request.specifier,
        request.fromFile.replace('/package.json', '/app/package.json'),
        {
          skipSelf: true,
          custom: {
            embroider: {
              enableCustomResolver: false,
              meta: request.meta,
            },
          },
        }
      );
    }
    if (result) {
      return { type: 'found', result };
    } else {
      return { type: 'not_found', err: undefined };
    }
  };
}
