import { AppFiles } from './app-files';
import { compile } from './js-handlebars';
import type { Resolver } from './module-resolver';
import { extensionsPattern } from '@embroider/shared-internals';
import type { V2AddonPackage } from '@embroider/shared-internals/src/package';
import { getAppFiles, importPaths, staticAppPathsPattern } from './virtual-entrypoint';

const entrypointPattern = /(?<filename>.*)[\\/]-embroider-test-entrypoint.js/;

export function decodeTestEntrypoint(filename: string): { fromFile: string } | undefined {
  // Performance: avoid paying regex exec cost unless needed
  if (!filename.includes('-embroider-test-entrypoint.js')) {
    return;
  }
  let m = entrypointPattern.exec(filename);
  if (m) {
    return {
      fromFile: m.groups!.filename,
    };
  }
}

export function renderTestEntrypoint(
  resolver: Resolver,
  { fromFile }: { fromFile: string }
): { src: string; watches: string[] } {
  const owner = resolver.packageCache.ownerOfFile(fromFile);

  if (!owner) {
    throw new Error(`Owner expected while loading test entrypoint from file: ${fromFile}`);
  }

  let engine = resolver.owningEngine(owner);

  let appFiles = new AppFiles(
    {
      package: owner,
      addons: new Map(
        engine.activeAddons.map(addon => [
          resolver.packageCache.get(addon.root) as V2AddonPackage,
          addon.canResolveFromFile,
        ])
      ),
      isApp: true,
      modulePrefix: resolver.options.modulePrefix,
      appRelativePath: 'NOT_USED_DELETE_ME',
    },
    getAppFiles(owner.root),
    new Set(), // no fastboot files
    extensionsPattern(resolver.options.resolvableExtensions),
    staticAppPathsPattern(resolver.options.staticAppPaths),
    resolver.options.podModulePrefix
  );

  let amdModules: { runtime: string; buildtime: string }[] = [];

  for (let relativePath of appFiles.tests) {
    amdModules.push(importPaths(resolver, appFiles, relativePath));
  }

  let src = entryTemplate({
    amdModules,
  });

  return {
    src,
    watches: [],
  };
}

const entryTemplate = compile(`
import { importSync as i } from '@embroider/macros';
let w = window;
let d = w.define;

import "ember-testing";
import "@embroider/core/entrypoint";

{{#each amdModules as |amdModule| ~}}
  d("{{js-string-escape amdModule.runtime}}", function(){ return i("{{js-string-escape amdModule.buildtime}}");});
{{/each}}

import('./tests/test-helper');
EmberENV.TESTS_FILE_LOADED = true;
`) as (params: { amdModules: { runtime: string; buildtime: string }[] }) => string;
