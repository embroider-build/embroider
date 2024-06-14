import type { Plugin as EsBuildPlugin } from 'esbuild';
import { type PluginItem, transform } from '@babel/core';
import { ResolverLoader, virtualContent, locateEmbroiderWorkingDir, explicitRelative } from '@embroider/core';
import { readFileSync, readJSONSync } from 'fs-extra';
import { EsBuildModuleRequest } from './esbuild-request';
import { dirname, isAbsolute, resolve } from 'path';
import { hbsToJS } from '@embroider/core';
import { Preprocessor } from 'content-tag';

function* candidates(path: string) {
  yield path;
  yield path + '.hbs';
}

export function esBuildResolver(root = process.cwd()): EsBuildPlugin {
  let resolverLoader = new ResolverLoader(process.cwd());
  let macrosConfig: PluginItem | undefined;
  let preprocessor = new Preprocessor();

  return {
    name: 'embroider-esbuild-resolver',
    setup(build) {
      // This resolver plugin is designed to test candidates for extensions and interoperates with our other embroider specific plugin
      // this is required for pre bundle phase, where our vite plugins do not take part and we do have rewritten-addons that still contain
      // hbs files
      build.onResolve({ filter: /./ }, async ({ path, importer, namespace, resolveDir, pluginData, kind }) => {
        if (pluginData?.embroiderExtensionSearch) {
          return null;
        }

        // from our app, not pre-bundle phase
        if (!importer.includes('node_modules')) {
          return null;
        }

        let firstFailure;

        for (let candidate of candidates(path)) {
          let result = await build.resolve(candidate, {
            namespace,
            resolveDir,
            importer,
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

        return null;
      });
      build.onResolve({ filter: /./ }, async args => {
        let excluded = resolverLoader.resolver.options.makeAbsolutePathToRwPackages;
        let { path, importer, pluginData, kind } = args;
        let request = EsBuildModuleRequest.from(build, kind, path, importer, pluginData);
        if (!request) {
          return null;
        }
        // during pre bundle we enter node modules, and then there are no user defined vite plugins
        if (importer.includes('node_modules')) {
          if (excluded && excluded.some((addon: string) => path?.startsWith(addon))) {
            return {
              external: true,
              path,
            };
          }
          let result = await resolverLoader.resolver.resolve(request);
          if (result.type === 'not_found') {
            return null;
          }
          if (!result.result.path?.includes('node_modules') && result.result.path?.includes(resolverLoader.appRoot)) {
            return {
              external: true,
              path: result.result.path,
            };
          }
          return result.result;
        }
        delete (args as any).path;
        args.pluginData = args.pluginData || {};
        args.pluginData.embroider = {
          enableCustomResolver: false,
          meta: request.meta,
        };
        // during dep scan we need to pass vite the actual bare import
        // so it can do its import analysis
        // this is something like what vite needs to do for aliases
        let alias = await resolverLoader.resolver.resolveAlias(request);
        if (excluded && excluded.some((addon: string) => path?.startsWith(addon))) {
          // just mark directly as external and do not tell vite
          return {
            external: true,
            path,
          };
        }
        alias = resolverLoader.resolver.makeResolvable(alias);
        args.importer = alias.fromFile || importer;
        path = alias.specifier;
        let res = (await build.resolve(path, args)) as any;
        if (!res) return null;
        if (res.path.includes('rewritten-packages')) {
          res.external = true;
        }
        if (res.path.includes('-embroider-implicit-')) {
          res.namespace = 'embroider';
        }
        return res;
      });

      build.onResolve({ filter: /./ }, async args => {
        let { path, importer, namespace, resolveDir, kind } = args;
        let { specifier, fromFile } = adjustVirtualImport(path, importer);
        if (specifier === path) {
          return null;
        }

        let result = await build.resolve(specifier, {
          namespace,
          resolveDir,
          importer: fromFile,
          kind,
          pluginData: {
            embroiderExtensionSearch: true,
            embroider: {
              enableCustomResolver: false,
            },
          },
        });

        if (result.errors.length === 0) {
          return result;
        }
        return null;
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
