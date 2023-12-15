import type { Plugin as EsBuildPlugin, ImportKind, OnResolveResult, PluginBuild } from 'esbuild';
import { transform } from '@babel/core';
import { type Resolution, type ResolverFunction, ResolverLoader, virtualContent } from '@embroider/core';
import { readFileSync } from 'fs-extra';
import { EsBuildModuleRequest } from './esbuild-request';
import assertNever from 'assert-never';
import { dirname, join } from 'path';
import { hbsToJS } from '@embroider/core';
import { Preprocessor } from 'content-tag';

export function esBuildResolver(root = process.cwd()): EsBuildPlugin {
  let resolverLoader = new ResolverLoader(root);
  let preprocessor = new Preprocessor();

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
            return resolution.result;
          case 'not_found':
            return resolution.err;
          default:
            throw assertNever(resolution);
        }
      });

      build.onLoad({ namespace: 'embroider', filter: /./ }, ({ path }) => {
        let src = virtualContent(path, resolverLoader.resolver);

        const result = transform(src, {
          configFile: join(root, 'babel.config.js'),
          filename: path,
        });

        if (!result || !result.code) {
          throw new Error(`Failed to load file ${path} in esbuild-hbs-loader`);
        }

        const contents = result.code;

        return { contents };
      });

      build.onLoad({ filter: /\.gjs$/ }, async ({ path: filename }) => {
        const code = readFileSync(filename, 'utf8');

        debugger;

        const result = transform(preprocessor.process(code, filename), {
          configFile: join(root, 'babel.config.js'),
          filename,
        });

        if (!result || !result.code) {
          throw new Error(`Failed to load file ${filename} in esbuild-hbs-loader`);
        }

        const contents = result.code;

        return { contents };
      });

      build.onLoad({ filter: /\.hbs$/ }, async ({ path: filename }) => {
        const code = readFileSync(filename, 'utf8');

        const result = transform(hbsToJS(code), { configFile: join(root, 'babel.config.js'), filename });

        if (!result || !result.code) {
          throw new Error(`Failed to load file ${filename} in esbuild-hbs-loader`);
        }

        const contents = result.code;

        return { contents };
      });

      build.onLoad({ filter: /\.js$/ }, ({ path, namespace }) => {
        let src: string;
        if (namespace === 'embroider') {
          src = virtualContent(path, resolverLoader.resolver);
        } else {
          src = readFileSync(path, 'utf8');
        }

        const result = transform(src, {
          configFile: join(root, 'babel.config.js'),
          filename: path,
        });

        if (!result || !result.code) {
          throw new Error(`Failed to load file ${path} in esbuild-hbs-loader`);
        }

        const contents = result.code;

        return { contents };
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
    if (request.isNotFound) {
      // todo: make sure this looks correct to users
      return {
        type: 'not_found',
        err: {
          errors: [{ text: `module not found ${request.specifier}` }],
        },
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
