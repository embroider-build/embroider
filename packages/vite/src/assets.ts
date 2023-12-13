import type { Resolver } from '@embroider/core';
import { getAppMeta, locateEmbroiderWorkingDir, ResolverLoader, virtualContent } from '@embroider/core';
import { join } from 'path/posix';
import { existsSync } from 'fs';
import CompatApp from '@embroider/compat/src/compat-app';
import type { Plugin } from 'vite';
import * as process from 'process';
import { RollupModuleRequest, virtualPrefix } from './request';

let InMemoryAssets: Record<string, string> = {};

let environment: 'production' | 'development' = 'production';



export function assets(): Plugin {
  const cwd = process.cwd();
  const root = join(cwd, 'app');
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
        const resolution = resolverLoader.resolver.resolveSync(request, (req) => ({ type: 'found', result: req.specifier }));
        if (resolution.result.startsWith(virtualPrefix)) {
          return virtualContent(resolution.result.slice(virtualPrefix.length), resolverLoader.resolver);
        }
      },
    },
  };
}
