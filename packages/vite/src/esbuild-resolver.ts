import type { Plugin as EsBuildPlugin } from 'esbuild';
import { type PluginItem, transform } from '@babel/core';
import { ResolverLoader, virtualContent, locateEmbroiderWorkingDir, explicitRelative } from '@embroider/core';
import { readFileSync, readJSONSync } from 'fs-extra';
import { EsBuildModuleRequest } from './esbuild-request';
import assertNever from 'assert-never';
import { dirname, isAbsolute, resolve } from 'path';
import { hbsToJS } from '@embroider/core';
import { Preprocessor } from 'content-tag';

function* candidates(path: string) {
  yield path;
  yield path + '.hbs';
  yield path + '.gjs';
  yield path + '.gts';
}

export function esBuildResolver(root = process.cwd()): EsBuildPlugin {
  let resolverLoader = new ResolverLoader(process.cwd());
  let macrosConfig: PluginItem | undefined;
  let preprocessor = new Preprocessor();

  return {
    name: 'embroider-esbuild-resolver',
    setup(build) {
      // This resolver plugin is designed to test candidates for extensions and interoperates with our other embroider specific plugin
      build.onResolve({ filter: /./ }, async ({ path, importer, namespace, resolveDir, pluginData, kind }) => {
        if (pluginData?.embroiderExtensionSearch) {
          return null;
        }

        let firstFailure;

        for (let candidate of candidates(path)) {
          let { specifier, fromFile } = adjustVirtualImport(candidate, importer);
          let result = await build.resolve(specifier, {
            namespace,
            resolveDir,
            importer: fromFile,
            kind,
            pluginData: { ...pluginData, embroiderExtensionSearch: true },
          });

          if (result.errors.length === 0) {
            return result;
          }

          if (!firstFailure) {
            firstFailure = result;
          }
        }

        return firstFailure;
      });
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

      build.onLoad({ namespace: 'embroider', filter: /./ }, ({ path }) => {
        // We don't want esbuild to try loading virtual CSS files
        if (path.endsWith('.css')) {
          return { contents: '' };
        }
        let { src } = virtualContent(path, resolverLoader.resolver);
        if (!macrosConfig) {
          macrosConfig = readJSONSync(resolve(locateEmbroiderWorkingDir(root), 'macros-config.json')) as PluginItem;
        }
        return { contents: runMacros(src, path, macrosConfig) };
      });

      build.onLoad({ filter: /\.g[jt]s$/ }, async ({ path: filename }) => {
        const code = readFileSync(filename, 'utf8');

        const result = transform(preprocessor.process(code, { filename }), {
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

        const result = transform(hbsToJS(code), { filename });

        if (!result || !result.code) {
          throw new Error(`Failed to load file ${filename} in esbuild-hbs-loader`);
        }

        const contents = result.code;

        return { contents };
      });

      build.onLoad({ filter: /\.[jt]s$/ }, ({ path, namespace }) => {
        let src: string;
        if (namespace === 'embroider') {
          src = virtualContent(path, resolverLoader.resolver).src;
        } else {
          src = readFileSync(path, 'utf8');
        }
        if (!macrosConfig) {
          macrosConfig = readJSONSync(resolve(locateEmbroiderWorkingDir(root), 'macros-config.json')) as PluginItem;
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
