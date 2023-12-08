import type { PluginContext, ResolveIdResult } from 'rollup';
import type { Plugin } from 'vite';
import { join, resolve } from 'path/posix';
import type { Resolution, ResolverFunction } from '@embroider/core';
import { ResolverLoader, virtualContent } from '@embroider/core';
import { readFileSync } from 'fs';
import { RollupModuleRequest, virtualPrefix } from './request';
import assertNever from 'assert-never';

const cwd = process.cwd();
const root = join(cwd, 'app');
const embroiderDir = join(cwd, 'node_modules', '.embroider');
const rewrittenApp = join(embroiderDir, 'rewritten-app');

type Options = {
  entryFolders: string[];
};

export function resolver(_options?: Options): Plugin {
  const resolverLoader = new ResolverLoader(process.cwd());
  resolverLoader.resolver.options.engines.forEach(engine => {
    engine.root = engine.root.replace(rewrittenApp, root);
    engine.activeAddons.forEach(addon => {
      addon.canResolveFromFile = addon.canResolveFromFile.replace(rewrittenApp, cwd);
    });
  });
  const pkg = resolverLoader.resolver.packageCache.get(cwd);
  pkg.packageJSON['ember-addon'] = pkg.packageJSON['ember-addon'] || {};
  pkg.packageJSON['keywords'] = pkg.packageJSON['keywords'] || [];
  pkg.packageJSON['ember-addon'].version = 2;
  pkg.packageJSON['ember-addon'].type = 'app';
  pkg.packageJSON['keywords'].push('ember-addon', 'ember-engine');
  pkg.meta!['auto-upgraded'] = true;
  (pkg as any).plainPkg.root = root;
  const json = pkg.packageJSON;
  Object.defineProperty(Object.getPrototypeOf((pkg as any).plainPkg), 'internalPackageJSON', {
    get() {
      if (this.isApp || this.root === root) {
        return json;
      }
      return JSON.parse(readFileSync(join(this.root, 'package.json'), 'utf8'));
    },
  });
  return {
    name: 'embroider-resolver',
    enforce: 'pre',
    async resolveId(source, importer, options) {
      if (source.startsWith('/assets/')) {
        return resolve(root, '.' + source);
      }
      if (importer?.includes(`${root}/assets/`) && !source.match(/-embroider-implicit-.*modules.js$/)) {
        if (source.startsWith('../tests')) {
          source = resolve(root, source);
        }
        if (source.startsWith('.')) {
          source = resolve(root, 'assets', source);
        }
        if (source.includes('/app/assets/')) {
          return source;
        }
      }
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
    if (!result && !request.specifier.includes('config/environment')) {
      result = await context.resolve(
        request.specifier,
        request.fromFile.replace('/app/package.json', '/package.json'),
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
    if (!result && request.specifier.includes('config/environment')) {
      result = await context.resolve(request.specifier, request.fromFile.replace(root, rewrittenApp), {
        skipSelf: true,
        custom: {
          embroider: {
            enableCustomResolver: false,
            meta: request.meta,
          },
        },
      });
    }
    if (result) {
      return { type: 'found', result };
    } else {
      return { type: 'not_found', err: undefined };
    }
  };
}
