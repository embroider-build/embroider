import type { Plugin as EsBuildPlugin, OnLoadResult, PluginBuild, ResolveResult } from 'esbuild';
import { transformAsync } from '@babel/core';
import core, { ModuleRequest, type VirtualResponse } from '@embroider/core';
const { ResolverLoader, virtualContent } = core;
import fs from 'fs-extra';
const { readFileSync } = fs;
import { EsBuildRequestAdapter } from './esbuild-request.js';
import { assertNever } from 'assert-never';
import { hbsToJS } from '@embroider/core';
import { Preprocessor } from 'content-tag';
import { extname } from 'path';

export function esBuildResolver(): EsBuildPlugin {
  let resolverLoader = new ResolverLoader(process.cwd());
  let preprocessor = new Preprocessor();

  async function transformAndAssert(src: string, filename: string): Promise<string> {
    const result = await transformAsync(src, { filename });
    if (!result || result.code == null) {
      throw new Error(`Failed to load file ${filename} in esbuild-hbs-loader`);
    }
    return result.code!;
  }

  async function onLoad({
    path,
    namespace,
    pluginData,
  }: {
    path: string;
    namespace: string;
    pluginData?: { virtual: VirtualResponse };
  }): Promise<OnLoadResult> {
    let src: string;
    if (namespace === 'embroider-virtual') {
      // castin because response in our namespace are supposed to always have
      // this pluginData.
      src = virtualContent(pluginData!.virtual, resolverLoader.resolver).src;
    } else {
      src = readFileSync(path, 'utf8');
    }
    if (path.endsWith('.hbs')) {
      src = hbsToJS(src);
    } else if (['.gjs', '.gts'].some(ext => path.endsWith(ext))) {
      src = preprocessor.process(src, { filename: path });
    }
    if (['.hbs', '.gjs', '.gts', '.js', '.ts'].some(ext => path.endsWith(ext))) {
      src = await transformAndAssert(src, path);
    }
    return { contents: src };
  }

  return {
    name: 'embroider-esbuild-resolver',
    setup(build) {
      const phase = detectPhase(build);

      // Embroider Resolver
      build.onResolve({ filter: /./ }, async ({ path, importer, pluginData, kind }) => {
        let request = ModuleRequest.create(EsBuildRequestAdapter.create, {
          packageCache: resolverLoader.resolver.packageCache,
          phase,
          build,
          kind,
          path,
          importer,
          pluginData,
        });
        if (!request) {
          return null;
        }
        let resolution = await resolverLoader.resolver.resolve(request);
        switch (resolution.type) {
          case 'found':
            return resolution.result;
          case 'not_found':
            return resolution.err;
          default:
            throw assertNever(resolution);
        }
      });

      if (phase === 'bundling') {
        // during bundling phase, we need to provide our own extension
        // searching. We do it here in its own resolve plugin so that it's
        // sitting beneath the embroider resolver since it expects the ambient
        // system to have extension search.
        build.onResolve({ filter: /./ }, async ({ path, importer, namespace, resolveDir, pluginData, kind }) => {
          if (pluginData?.embroiderExtensionResolving) {
            // reentrance
            return null;
          }

          let firstResult: ResolveResult | undefined;

          for (let requestName of extensionSearch(path, resolverLoader.resolver.options.resolvableExtensions)) {
            let result = await build.resolve(requestName, {
              namespace,
              resolveDir,
              importer,
              kind,
              // avoid reentrance
              pluginData: { ...pluginData, embroiderExtensionResolving: true },
            });

            if (result.errors.length > 0) {
              // if extension search fails, we want to let the first failure be the
              // one that propagates, so that the error message makes sense.
              firstResult = result;
            } else {
              return result;
            }
          }

          return firstResult;
        });
      }

      // we need to handle everything from our special namespaces
      build.onLoad({ namespace: 'embroider-virtual', filter: /./ }, onLoad);
      build.onLoad({ namespace: 'embroider-template-tag', filter: /./ }, onLoad);

      // we need to handle all hbs
      build.onLoad({ filter: /\.hbs$/ }, onLoad);

      // we need to handle all GJS (to preprocess) and JS (to run macros)
      build.onLoad({ filter: /\.g?[jt]s$/ }, onLoad);
    },
  };
}

function detectPhase(build: PluginBuild): 'bundling' | 'other' {
  let plugins = (build.initialOptions.plugins ?? []).map(p => p.name);
  if (plugins.includes('vite:dep-pre-bundle')) {
    return 'bundling';
  } else {
    return 'other';
  }
}

function* extensionSearch(specifier: string, extensions: string[]): Generator<string> {
  yield specifier;
  // when there's no explicit extension, we may do extension search
  if (extname(specifier) === '') {
    for (let ext of extensions) {
      yield specifier + ext;
    }
  }
}
