import type { Plugin as EsBuildPlugin, ImportKind, OnResolveResult, PluginBuild } from 'esbuild';
import type { Resolution, ResolverFunction } from '@embroider/core';
import { ResolverLoader } from '@embroider/core';
import { EsBuildModuleRequest } from './esbuild-request';
import assertNever from 'assert-never';
import { dirname } from 'path';

export function esBuildResolver(): EsBuildPlugin {
  let resolverLoader = new ResolverLoader(process.cwd());

  return {
    name: 'embroider-esbuild-resolver',
    setup(build) {
      build.onResolve({ filter: /./ }, async ({ path, importer, pluginData, kind }) => {
        let request = EsBuildModuleRequest.from(path, importer, pluginData);
        if (!request) {
          return null;
        }
        let resolution = await resolverLoader.resolver.resolve(request, defaultResolve(build, kind));
        switch (resolution.type) {
          case 'found':
            return {
              ...resolution.result,
              external: true,
            };
          case 'not_found':
            return resolution.err;
          default:
            throw assertNever(resolution);
        }
      });
    },
  };
}

function defaultResolve(
  context: PluginBuild,
  kind: ImportKind
): ResolverFunction<EsBuildModuleRequest, Resolution<OnResolveResult, OnResolveResult>> {
  return async (request: EsBuildModuleRequest) => {
    if (request.isVirtual) {
      return {
        type: 'found',
        result: { path: request.specifier, namespace: 'embroider' },
      };
    }
    let result = await context.resolve(request.specifier, {
      importer: request.fromFile,
      resolveDir: dirname(request.fromFile),
      kind,
      pluginData: {
        embroider: {
          enableCustomResolver: false,
          meta: request.meta,
        },
      },
    });
    if (result.errors.length > 0) {
      return { type: 'not_found', err: result };
    } else {
      return { type: 'found', result };
    }
  };
}
