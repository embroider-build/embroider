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
import { extname, resolve, dirname } from 'path';
import { BackChannel } from './backchannel.js';

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
      let { code /*,  map */ } = preprocessor.process(src, { filename: path, inline_source_map: true });
      src = code;
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

      let backChannel: BackChannel | undefined;
      if (phase === 'scanning') {
        // this is created here because of the lifetime it should have. When we
        // catch vite lying to esbuild about missing deps actually being
        // "external", we need to remember that fact for the remainder of the
        // depscan, because if esbuild asks again it will hit a cache and we
        // won't get to observe it again.
        backChannel = new BackChannel();
      }

      if (phase === 'bundling') {
        // When the @embroider/macros babel plugin rewrites
        // `import { isTesting } from '@embroider/macros'` it emits a relative
        // file path pointing at runtime.js.  If we let esbuild resolve that
        // relative path normally it will *inline* runtime.js into every dep
        // bundle, giving each bundle its own runtimeConfig object.  Calling
        // setTesting() in one context then has no effect on another, so
        // isTesting() in a consumed v2 addon returns the wrong value.
        //
        // By marking the resolved file as external with its root-relative path
        // (e.g. /node_modules/@embroider/macros/src/addon/runtime.js), esbuild
        // leaves an `import` statement in the bundle output.  Vite's dev server
        // then serves ALL references to that path from the same URL, so every
        // dep bundle and the app code share one module instance.
        //
        // IMPORTANT: this hook must be registered BEFORE the Embroider Resolver
        // below, because esbuild calls onResolve hooks in registration order and
        // the Embroider Resolver uses filter /./ which would otherwise win first.
        // See https://github.com/embroider-build/embroider/issues/2660
        build.onResolve(
          { filter: /[/\\]macros[/\\]src[/\\]addon[/\\]runtime(\.js)?$/ },
          ({ path, resolveDir, importer }) => {
            if (!path.startsWith('.') && !path.startsWith('/')) {
              return null; // bare specifier – handled elsewhere
            }
            const base = resolveDir || (importer ? dirname(importer) : undefined);
            if (!base) return null;
            const absolutePath = resolve(base, path);
            const withoutExt = absolutePath.replace(/\.js$/, '');
            if (/[/\\]macros[/\\]src[/\\]addon[/\\]runtime$/.test(withoutExt)) {
              // Use a root-relative path so Vite's dev server always serves this
              // file at the same URL regardless of which dep bundle references it.
              // This avoids the ?v=hash URL divergence that causes duplicate
              // runtime instances. See https://github.com/embroider-build/embroider/issues/2660
              const absoluteWithExt = withoutExt + '.js';
              const cwd = process.cwd();
              if (!absoluteWithExt.startsWith(cwd)) {
                // The macros runtime is outside the project root (unusual edge case,
                // e.g. a workspace with a parent-level install). Skip the external
                // marking and let esbuild handle it normally rather than emit a
                // path that the browser cannot reach.
                return null;
              }
              const rootRelative = absoluteWithExt.slice(cwd.length).replace(/\\/g, '/');
              return { path: rootRelative, external: true };
            }
            return null;
          }
        );
      }

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
          backChannel,
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

function detectPhase(build: PluginBuild): 'bundling' | 'scanning' | 'other' {
  let plugins = (build.initialOptions.plugins ?? []).map(p => p.name);
  if (plugins.includes('vite:dep-pre-bundle')) {
    return 'bundling';
  } else if (plugins.includes('vite:dep-scan')) {
    return 'scanning';
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
