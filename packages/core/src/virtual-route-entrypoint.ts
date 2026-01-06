import type { V2AddonPackage } from '@embroider/shared-internals/src/package';
import { AppFiles } from './app-files';
import type { Resolver } from './module-resolver';
import { compile } from './js-handlebars';
import { extensionsPattern } from '@embroider/shared-internals';
import { partition } from 'lodash';
import { getAppFiles, getFastbootFiles, importPaths, splitRoute, staticAppPathsPattern } from './virtual-entrypoint';

export interface RouteEntrypointResponse {
  type: 'route-entrypoint';
  fromDir: string;
  route: string;
}

// Cache AppFiles instances by fromDir to avoid recreating them for every route
const appFilesCache = new Map();

export function renderRouteEntrypoint(
  { fromDir, route }: RouteEntrypointResponse,
  resolver: Resolver
): { src: string; watches: string[] } {
  const owner = resolver.packageCache.ownerOfFile(fromDir);

  if (!owner) {
    throw new Error('Owner expected'); // ToDo: Really bad error, update message
  }

  let engine = resolver.owningEngine(owner);
  let isApp = owner?.root === resolver.options.engines[0]!.root;
  let hasFastboot = Boolean(resolver.options.engines[0]!.activeAddons.find(a => a.name === 'ember-cli-fastboot'));
  let appFiles = appFilesCache.get(fromDir);

  if (!appFiles) {
    appFiles = new AppFiles(
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

    appFilesCache.set(fromDir, appFiles);
  }

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
const output = {};
export default output;

{{#each amdModules as |amdModule index| ~}}
  import * as amdModule{{index}} from "{{js-string-escape amdModule.buildtime}}"
  output["{{js-string-escape amdModule.runtime}}"] = amdModule{{index}};
{{/each}}

{{#if fastbootOnlyAmdModules}}
  if (macroCondition(getGlobalConfig().fastboot?.isRunning)) {
    {{#each fastbootOnlyAmdModules as |amdModule| ~}}
      output["{{js-string-escape amdModule.runtime}}"] = await import("{{js-string-escape amdModule.buildtime}}");
    {{/each}}
  }
{{/if}}
`) as (params: {
  amdModules: { runtime: string; buildtime: string }[];
  fastbootOnlyAmdModules: { runtime: string; buildtime: string }[];
}) => string;
