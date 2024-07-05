import type { Plugin as EsBuildPlugin, OnLoadResult } from 'esbuild';
import { transform } from '@babel/core';
import { ResolverLoader, virtualContent, explicitRelative, needsSyntheticComponentJS } from '@embroider/core';
import { readFileSync } from 'fs-extra';
import { EsBuildModuleRequest } from './esbuild-request';
import assertNever from 'assert-never';
import { dirname, isAbsolute, resolve } from 'path';
import { hbsToJS } from '@embroider/core';
import { Preprocessor } from 'content-tag';

const templateOnlyComponent =
  `import templateOnly from '@ember/component/template-only';\n` + `export default templateOnly();\n`;

export function esBuildResolver(): EsBuildPlugin {
  let resolverLoader = new ResolverLoader(process.cwd());
  let preprocessor = new Preprocessor();

  function transformAndAssert(src: string, filename: string): string {
    const result = transform(src, { filename });
    if (!result || !result.code) {
      throw new Error(`Failed to load file ${filename} in esbuild-hbs-loader`);
    }
    return result.code!;
  }

  function onLoad({ path, namespace }: { path: string; namespace: string }): OnLoadResult {
    if (namespace === 'embroider-template-only-component') {
      return { contents: templateOnlyComponent };
    }
    let src: string;
    if (namespace === 'embroider-virtual') {
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
        let { specifier, fromFile } = adjustVirtualImport(path, importer);
        let request = EsBuildModuleRequest.from(build, kind, specifier, fromFile, pluginData);
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

// esbuild's resolve does not like when we resolve from virtual paths. That is,
// a request like "../thing.js" from "/a/real/path/VIRTUAL_SUBDIR/virtual.js"
// has an unambiguous target of "/a/real/path/thing.js", but esbuild won't do
// that path adjustment until after checking whether VIRTUAL_SUBDIR actually
// exists.
//
// We can do the path adjustments before doing resolve.
function adjustVirtualImport(specifier: string, fromFile: string): { specifier: string; fromFile: string } {
  let fromDir = dirname(fromFile);
  if (!isAbsolute(specifier) && specifier.startsWith('.')) {
    let targetPath = resolve(fromDir, specifier);
    let newFromDir = dirname(targetPath);
    if (fromDir !== newFromDir) {
      return {
        specifier: explicitRelative(newFromDir, targetPath),
        // we're resolving *from* the destination, because we need to resolve
        // from a file that exists, and we know that (if this was supposed to
        // succeed at all) that file definitely does
        fromFile: targetPath,
      };
    }
  }
  return { specifier, fromFile };
}
