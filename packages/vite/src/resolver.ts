import type { PluginContext, ResolveIdResult } from 'rollup';
import type { Plugin } from 'vite';
import { join, resolve } from 'path';
import type { Resolution, ResolverFunction, ResolverOptions } from '@embroider/core';
import { Resolver, locateEmbroiderWorkingDir, virtualContent } from '@embroider/core';
import { readJSONSync } from 'fs-extra';
import { existsSync, promises, readFileSync } from 'fs';
import { RollupModuleRequest, virtualPrefix } from './request';
import assertNever from 'assert-never';

export function resolver(): Plugin {
  const cwd = process.cwd();
  const root = join(cwd, 'app');
  const tests = join(cwd, 'tests');
  const embroiderDir = locateEmbroiderWorkingDir(cwd);
  const rewrittenApp = join(embroiderDir, 'rewritten-app');

  const appIndex = resolve(root, "index.html").replace(/\\/g, '/');
  const testsIndex = resolve(tests, "index.html").replace(/\\/g, '/');
  const rewrittenAppIndex = resolve(rewrittenApp, 'index.html');
  const rewrittenTestIndex = resolve(rewrittenApp, 'tests', 'index.html');

  let resolverOptions: ResolverOptions = readJSONSync(join(embroiderDir, 'resolver.json'));
  let resolver = new Resolver(resolverOptions);
  return {
    name: 'embroider-resolver',
    enforce: 'pre',
    async resolveId(source: string, importer, options) {
      // if (source.startsWith(virtualPrefix)) {
      //   return source;
      // }
      if (false) {
        const rewrittenImporter = importer.replace(root, rewrittenApp);
        if (source.startsWith('/') && !source.startsWith(cwd)) {
          source = rewrittenApp + source;
        }
        const r = await this.resolve(source, rewrittenImporter, { ...options });
        if (r && !r.id.includes('/assets/')) {
          r.id = r.id.replace(rewrittenApp, root);
        }
        if (r && r.id) {
          const rewritten = r.id.replace(rewrittenApp, root);
          if (existsSync(rewritten)) {
            r.id = rewritten;
          }
        }
        return r;
      }

      let request = RollupModuleRequest.from(source, importer, options.custom);
      if (!request) {
        // fallthrough to other rollup plugins
        return null;
      }
      let resolution = await resolver.resolve(request, defaultResolve(this));
      switch (resolution.type) {
        case 'found':
          return resolution.result;
        case 'not_found':
          return null;
        default:
          throw assertNever(resolution);
      }
    },
    async load(id: string) {
      if (id.startsWith(virtualPrefix)) {
        const vId = id.split(virtualPrefix)[1].replace(root, rewrittenApp);
        return virtualContent(vId, resolver);
      }

      if (id.startsWith(root)) {
        try {
          return (await promises.readFile(id.split('?')[0])).toString();
        } catch (e) {
        }
        try {
          const rewId = id.replace(root, rewrittenApp);
          return (await promises.readFile(rewId.split('?')[0])).toString();
        } catch (e) {
        }
      }
      return null;
    },
    transformIndexHtml: {
      order: 'pre',
      handler(_html, ctx) {
        if (ctx.filename === appIndex) {
          return readFileSync(rewrittenAppIndex).toString();
        }
        if (ctx.filename === testsIndex) {
          return readFileSync(rewrittenTestIndex).toString();
        }
      }
    }
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
