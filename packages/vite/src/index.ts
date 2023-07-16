import type { PluginContext, ResolveIdHook, ResolveIdResult } from 'rollup';
import { Plugin } from 'vite';
import { join } from 'path';
import {
  Resolution,
  Resolver,
  ResolverFunction,
  ResolverOptions,
  locateEmbroiderWorkingDir,
  virtualContent,
} from '@embroider/core';
import { readJSONSync } from 'fs-extra';
import { RollupModuleRequest, virtualPrefix } from './request';
import assertNever from 'assert-never';

export function embroider(): Plugin {
  let resolverOptions: ResolverOptions = readJSONSync(join(locateEmbroiderWorkingDir(process.cwd()), 'resolver.json'));
  let resolver = new Resolver(resolverOptions);

  return {
    name: 'embroider',
    enforce: 'pre',
    async resolveId(source, importer, options) {
      let request = RollupModuleRequest.from(source, importer);
      if (!request || !(options.custom?.embroider?.enableCustomResolver ?? true)) {
        // fallthrough to other rollup plugins
        return null;
      }
      let resolution = await resolver.resolve(request, defaultResolve(this, options));
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
        return virtualContent(id.slice(virtualPrefix.length), resolver);
      }
    },
  };
}

function defaultResolve(
  context: PluginContext,
  options: Parameters<ResolveIdHook>[2]
): ResolverFunction<RollupModuleRequest, Resolution<ResolveIdResult>> {
  return async (request: RollupModuleRequest) => {
    if (request.isVirtual) {
      return {
        type: 'found',
        result: { id: request.specifier, resolvedBy: request.fromFile },
      };
    }
    let result = await context.resolve(request.specifier, request.fromFile, {
      ...options,
      skipSelf: true,
    });
    if (result) {
      return { type: 'found', result };
    } else {
      return { type: 'not_found', err: undefined };
    }
  };
}
