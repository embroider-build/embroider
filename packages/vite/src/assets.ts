import { ResolverLoader, virtualContent } from '@embroider/core';
import type { Plugin } from 'vite';
import * as process from 'process';
import { RollupModuleRequest, virtualPrefix } from './request';

let environment: 'production' | 'development' = 'production';

export function assets(): Plugin {
  const cwd = process.cwd();
  const resolverLoader = new ResolverLoader(cwd);
  resolverLoader.resolver.options.environment = environment;

  return {
    name: 'assets',
    enforce: 'pre',
    configureServer() {
      environment = 'development';
    },
    transformIndexHtml: {
      order: 'pre',
      async handler(_html, ctx) {
        const request = RollupModuleRequest.from(ctx.filename, '<stdin>', {})!;
        const resolution = resolverLoader.resolver.resolveSync(request, req => ({
          type: 'found',
          result: req.specifier,
        }));
        if (resolution.result.startsWith(virtualPrefix)) {
          return virtualContent(resolution.result.slice(virtualPrefix.length), resolverLoader.resolver);
        }
      },
    },
  };
}
