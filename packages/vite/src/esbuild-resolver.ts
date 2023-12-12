import type { Plugin as EsBuildPlugin, ImportKind, OnResolveResult, PluginBuild } from 'esbuild';
import { type PluginItem, transform } from '@babel/core';
import {
  type Resolution,
  type ResolverFunction,
  ResolverLoader,
  virtualContent,
  locateEmbroiderWorkingDir,
} from '@embroider/core';
import { readFileSync, readJSONSync } from 'fs-extra';
import { EsBuildModuleRequest } from './esbuild-request';
import assertNever from 'assert-never';
import { dirname, resolve, join } from 'path';
import { hbsToJS } from '@embroider/core';
import { Preprocessor } from 'content-tag';

export function esBuildResolver(root = process.cwd()): EsBuildPlugin {
  let resolverLoader = new ResolverLoader(process.cwd());
  let macrosConfig: PluginItem | undefined;
  let preprocessor = new Preprocessor();

  return {
    name: 'embroider-esbuild-resolver',
    setup(build) {
      build.onResolve({ filter: /./ }, async ({ path, importer, pluginData, kind }) => {
        if (importer.includes('rewritten-app')) {
          importer = importer.split('rewritten')[1];
        }
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
        if (!macrosConfig) {
          macrosConfig = readJSONSync(
            resolve(locateEmbroiderWorkingDir(root), 'rewritten-app', 'macros-config.json')
          ) as PluginItem;
        }
        return { contents: runMacros(src, path, macrosConfig) };
      });

      build.onLoad({ filter: /\.gjs$/ }, async ({ path: filename }) => {
        const code = readFileSync(filename, 'utf8');

        const result = transform(preprocessor.process(code, filename), {
          configFile: join(process.cwd(), 'babel.config.js'),
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

        const result = transform(hbsToJS(code), { configFile: join(process.cwd(), 'babel.config.js'), filename });

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
        if (!macrosConfig) {
          macrosConfig = readJSONSync(
            resolve(locateEmbroiderWorkingDir(root), 'rewritten-app', 'macros-config.json')
          ) as PluginItem;
        }
        return { contents: runMacros(src, path, macrosConfig) };
      });
    },
  };
}

function runMacros(src: string, filename: string, macrosConfig: PluginItem): string {
  return transform(src, {
    filename,
    plugins: [macrosConfig],
  })!.code!;
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
