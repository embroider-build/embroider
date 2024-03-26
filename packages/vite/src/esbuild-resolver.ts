import type { Plugin as EsBuildPlugin, OnLoadResult, PluginBuild, ResolveResult } from 'esbuild';
import { transform } from '@babel/core';
import { ResolverLoader, virtualContent, needsSyntheticComponentJS, isInComponents } from '@embroider/core';
import { readFileSync } from 'fs-extra';
import { EsBuildModuleRequest } from './esbuild-request';
import assertNever from 'assert-never';
import { hbsToJS } from '@embroider/core';
import { Preprocessor } from 'content-tag';
import { extname } from 'path';

const templateOnlyComponent =
  `import templateOnly from '@ember/component/template-only';\n` + `export default templateOnly();\n`;

export function esBuildResolver(): EsBuildPlugin {
  let resolverLoader = new ResolverLoader(process.cwd());
  let preprocessor = new Preprocessor();

  function transformAndAssert(src: string, filename: string): string {
    const result = transform(src, { filename });
    if (!result || result.code == null) {
      throw new Error(`Failed to load file ${filename} in esbuild-hbs-loader`);
    }
    return result.code!;
  }

  function onLoad({ path, namespace }: { path: string; namespace: string }): OnLoadResult {
    let src: string;
    if (namespace === 'embroider-template-only-component') {
      src = templateOnlyComponent;
    } else if (namespace === 'embroider-virtual') {
      src = virtualContent(path, resolverLoader.resolver).src;
    } else {
      src = readFileSync(path, 'utf8');
    }
    if (path.endsWith('.hbs')) {
      src = hbsToJS(src);
    } else if (['.gjs', '.gts'].some(ext => path.endsWith(ext))) {
      src = preprocessor.process(src, { filename: path });
    }
    if (['.hbs', '.gjs', '.gts', '.js', '.ts'].some(ext => path.endsWith(ext))) {
      src = transformAndAssert(src, path);
    }
    return { contents: src };
  }

  return {
    name: 'embroider-esbuild-resolver',
    setup(build) {
      const phase = detectPhase(build);

      // Embroider Resolver
      build.onResolve({ filter: /./ }, async ({ path, importer, pluginData, kind }) => {
        let request = EsBuildModuleRequest.from(
          resolverLoader.resolver.packageCache,
          phase,
          build,
          kind,
          path,
          importer,
          pluginData
        );
        if (!request) {
          return null;
        }
        let resolution = await resolverLoader.resolver.resolve(request);
        switch (resolution.type) {
          case 'found':
          case 'ignored':
            return resolution.result;
          case 'not_found':
            return resolution.err;
          default:
            throw assertNever(resolution);
        }
      });

      // template-only-component synthesis
      build.onResolve({ filter: /./ }, async ({ path, importer, namespace, resolveDir, pluginData, kind }) => {
        if (pluginData?.embroiderHBSResolving) {
          // reentrance
          return null;
        }

        let result = await build.resolve(path, {
          namespace,
          resolveDir,
          importer,
          kind,
          // avoid reentrance
          pluginData: { ...pluginData, embroiderHBSResolving: true },
        });

        if (result.errors.length === 0 && !result.external) {
          let syntheticPath = needsSyntheticComponentJS(path, result.path);
          if (syntheticPath && isInComponents(result.path, resolverLoader.resolver.packageCache)) {
            return { path: syntheticPath, namespace: 'embroider-template-only-component' };
          }
        }

        return result;
      });

      if (phase === 'bundling') {
        // during bundling phase, we need to provide our own extension
        // searching. We do it here in its own resolve plugin so that it's
        // sitting beneath both embroider resolver and template-only-component
        // synthesizer, since both expect the ambient system to have extension
        // search.
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

      // we need to handle everything from one of our three special namespaces:
      build.onLoad({ namespace: 'embroider-template-only-component', filter: /./ }, onLoad);
      build.onLoad({ namespace: 'embroider-virtual', filter: /./ }, onLoad);
      build.onLoad({ namespace: 'embroider-template-tag', filter: /./ }, onLoad);

      // we need to handle all hbs
      build.onLoad({ filter: /\.hbs$/ }, onLoad);

      // we need to handle all GJS (to preprocess) and JS (to run macros)
      build.onLoad({ filter: /\.g?[jt]s$/ }, onLoad);
    },
  };
}

function detectPhase(build: PluginBuild): 'bundling' | 'scanning' {
  let plugins = (build.initialOptions.plugins ?? []).map(p => p.name);
  if (plugins.includes('vite:dep-pre-bundle')) {
    return 'bundling';
  } else if (plugins.includes('vite:dep-scan')) {
    return 'scanning';
  } else {
    throw new Error(`cannot identify what phase vite is in. Saw plugins: ${plugins.join(', ')}`);
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
