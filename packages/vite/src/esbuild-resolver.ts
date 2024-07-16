import type { Plugin as EsBuildPlugin, OnLoadResult } from 'esbuild';
import { transform } from '@babel/core';
import { ResolverLoader, virtualContent, needsSyntheticComponentJS } from '@embroider/core';
import { readFileSync } from 'fs-extra';
import { EsBuildModuleRequest } from './esbuild-request';
import assertNever from 'assert-never';
import { hbsToJS } from '@embroider/core';
import { Preprocessor } from 'content-tag';

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
      // Embroider Resolver
      build.onResolve({ filter: /./ }, async ({ path, importer, pluginData, kind }) => {
        let request = EsBuildModuleRequest.from(build, kind, path, importer, pluginData);
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
        if (pluginData?.embroiderExtensionResolving) {
          // reentrance
          return null;
        }

        let result = await build.resolve(path, {
          namespace,
          resolveDir,
          importer,
          kind,
          // avoid reentrance
          pluginData: { ...pluginData, embroiderExtensionResolving: true },
        });

        if (result.errors.length === 0 && !result.external) {
          let syntheticPath = needsSyntheticComponentJS(path, result.path, resolverLoader.resolver.packageCache);
          if (syntheticPath) {
            return { path: syntheticPath, namespace: 'embroider-template-only-component' };
          }
        }

        return result;
      });

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
