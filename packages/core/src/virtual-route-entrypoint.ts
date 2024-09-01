import type { V2AddonPackage } from '@embroider/shared-internals/src/package';
import { AppFiles } from './app-files';
import type { Resolver } from './module-resolver';
import { resolve } from 'path';
import { compile } from './js-handlebars';
import { extensionsPattern } from '@embroider/shared-internals';
import { partition } from 'lodash';
import { getAppFiles, getFastbootFiles, importPaths, splitRoute, staticAppPathsPattern } from './virtual-entrypoint';

const entrypointPattern = /(?<filename>.*)[\\/]-embroider-route-entrypoint.js:route=(?<route>.*)/;

export function encodeRouteEntrypoint(packagePath: string, matched: string | undefined, routeName: string): string {
  return resolve(packagePath, `${matched}:route=${routeName}` ?? `-embroider-route-entrypoint.js:route=${routeName}`);
}

export function decodeRouteEntrypoint(filename: string): { fromDir: string; route: string } | undefined {
  // Performance: avoid paying regex exec cost unless needed
  if (!filename.includes('-embroider-route-entrypoint')) {
    return;
  }
  let m = entrypointPattern.exec(filename);
  if (m) {
    return {
      fromDir: m.groups!.filename,
      route: m.groups!.route,
    };
  }
}

export function encodePublicRouteEntrypoint(routeNames: string[], _files: string[]) {
  return `@embroider/core/route/${encodeURIComponent(routeNames[0])}`;
}

export function decodePublicRouteEntrypoint(specifier: string): string | null {
  const publicPrefix = '@embroider/core/route/';
  if (!specifier.startsWith(publicPrefix)) {
    return null;
  }

  return specifier.slice(publicPrefix.length);
}

export function renderRouteEntrypoint(
  resolver: Resolver,
  { fromDir, route }: { fromDir: string; route: string }
): { src: string; watches: string[] } {
  const owner = resolver.packageCache.ownerOfFile(fromDir);

  if (!owner) {
    throw new Error('Owner expected'); // ToDo: Really bad error, update message
  }

  let engine = resolver.owningEngine(owner);
  let isApp = owner?.root === resolver.options.engines[0]!.root;
  let hasFastboot = Boolean(resolver.options.engines[0]!.activeAddons.find(a => a.name === 'ember-cli-fastboot'));

  let appFiles = new AppFiles(
    {
      package: owner,
      addons: new Map(
        engine.activeAddons.map(addon => [
          resolver.packageCache.get(addon.root) as V2AddonPackage,
          addon.canResolveFromFile,
        ])
      ),
      isApp,
      modulePrefix: isApp ? resolver.options.modulePrefix : engine.packageName,
      appRelativePath: 'NOT_USED_DELETE_ME',
    },
    getAppFiles(fromDir),
    hasFastboot ? getFastbootFiles(owner.root) : new Set(),
    extensionsPattern(resolver.options.resolvableExtensions),
    staticAppPathsPattern(resolver.options.staticAppPaths),
    resolver.options.podModulePrefix
  );

  let src = '';

  for (let [routeName, routeFiles] of appFiles.routeFiles.children) {
    splitRoute(
      routeName,
      routeFiles,
      resolver.options.splitAtRoutes,
      (_: string, _filename: string) => {
        // noop
      },
      (routeNames: string[], routeFiles: string[]) => {
        if (routeNames[0] === route) {
          let [fastboot, nonFastboot] = partition(routeFiles, file => appFiles.isFastbootOnly.get(file));

          const amdModules = nonFastboot.map(f => importPaths(resolver, appFiles, f));
          const fastbootOnlyAmdModules = fastboot.map(f => importPaths(resolver, appFiles, f));

          src = routeEntryTemplate({
            amdModules,
            fastbootOnlyAmdModules,
          });
        }
      }
    );
  }

  return { src, watches: [] };
}

const routeEntryTemplate = compile(`
let d = window.define;

{{#each amdModules as |amdModule index| ~}}
  import * as amdModule{{index}} from "{{js-string-escape amdModule.buildtime}}"
  d("{{js-string-escape amdModule.runtime}}", function(){ return amdModule{{index}}; });
{{/each}}

{{#if fastbootOnlyAmdModules}}
  if (macroCondition(getGlobalConfig().fastboot?.isRunning)) {
    let fastbootModules = {};

    {{#each fastbootOnlyAmdModules as |amdModule| ~}}
      fastbootModules["{{js-string-escape amdModule.runtime}}"] = import("{{js-string-escape amdModule.buildtime}}");
    {{/each}}

    const resolvedValues = await Promise.all(Object.values(fastbootModules));

    Object.keys(fastbootModules).forEach((k, i) => {
      d(k, function(){ return resolvedValues[i];});
    })
  }
{{/if}}
`) as (params: {
  amdModules: { runtime: string; buildtime: string }[];
  fastbootOnlyAmdModules: { runtime: string; buildtime: string }[];
}) => string;
