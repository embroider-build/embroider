import type { Plugin as EsBuildPlugin } from 'esbuild';
import { type PluginItem, transform } from '@babel/core';
import { ResolverLoader, virtualContent, locateEmbroiderWorkingDir } from '@embroider/core';
import { readFileSync, readJSONSync } from 'fs-extra';
import { EsBuildModuleRequest } from './esbuild-request';
import assertNever from 'assert-never';
import { resolve, join } from 'path';
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

        return firstFailure;
      });
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

      build.onLoad({ namespace: 'embroider', filter: /./ }, ({ path }) => {
        let { src } = virtualContent(path, resolverLoader.resolver);
        if (!macrosConfig) {
          macrosConfig = readJSONSync(
            resolve(locateEmbroiderWorkingDir(root), 'rewritten-app', 'macros-config.json')
          ) as PluginItem;
        }
        return { contents: runMacros(src, path, macrosConfig) };
      });

      build.onLoad({ filter: /\.g[jt]s$/ }, async ({ path: filename }) => {
        const code = readFileSync(filename, 'utf8');

        const result = transform(preprocessor.process(code, { filename }), {
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

      build.onLoad({ filter: /\.[jt]s$/ }, ({ path, namespace }) => {
        let src: string;
        if (namespace === 'embroider') {
          src = virtualContent(path, resolverLoader.resolver).src;
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
