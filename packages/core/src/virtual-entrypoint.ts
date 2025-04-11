import { AppFiles, type RouteFiles } from './app-files';
import { compile } from './js-handlebars';
import type { Resolver } from './module-resolver';
import { flatten, partition } from 'lodash';
import { join } from 'path';
import { extensionsPattern } from '@embroider/shared-internals';
import walkSync from 'walk-sync';
import type { V2AddonPackage } from '@embroider/shared-internals/src/package';
import escapeRegExp from 'escape-string-regexp';
import { optionsWithDefaults } from './options';

export interface EntrypointResponse {
  type: 'entrypoint';
  fromDir: string;
  specifier: string;
}

export function staticAppPathsPattern(staticAppPaths: string[] | undefined): RegExp | undefined {
  if (staticAppPaths && staticAppPaths.length > 0) {
    return new RegExp('^(?:' + staticAppPaths.map(staticAppPath => escapeRegExp(staticAppPath)).join('|') + ')(?:$|/)');
  }
}

export function renderEntrypoint(
  resolver: Resolver,
  { fromDir }: { fromDir: string }
): { src: string; watches: string[] } {
  const owner = resolver.packageCache.ownerOfFile(fromDir);

  let eagerModules: string[] = [];

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

  /**
   * we are only reading staticInvokables off this type so I'm setting the type manually here. I don't know why
   * resolver.options is reporting an incorrect type here, but I have verified this programatically that this
   * is the right shape here and tests fail if it is wrong anyway
   */
  let options =
    (resolver.options as unknown as { options: { staticInvokables: boolean } }).options ?? optionsWithDefaults();

  let requiredAppFiles = [appFiles.otherAppFiles];
  if (!options.staticInvokables) {
    requiredAppFiles.push(appFiles.components);
    requiredAppFiles.push(appFiles.helpers);
    requiredAppFiles.push(appFiles.modifiers);
  }

  let styles = [];
  // only import styles from engines with a parent (this excludeds the parent application) as their styles
  // will be inserted via a direct <link> tag.
  if (!appFiles.engine.isApp && appFiles.engine.package.isLazyEngine()) {
    styles.push({
      path: '@embroider/virtual/vendor.css',
    });
  }

  let lazyEngines: { names: string[]; path: string }[] = [];

  if (isApp) {
    // deliberately ignoring the app (which is the first entry in the engines array)
    let [, ...childEngines] = resolver.options.engines;
    for (let childEngine of childEngines) {
      let target = `@embroider/virtual/compat-modules/${childEngine.packageName}`;

      if (childEngine.isLazy) {
        lazyEngines.push({
          names: [childEngine.packageName],
          path: target,
        });
      } else {
        eagerModules.push(target);
      }
    }
  }

  let lazyRoutes: { names: string[]; path: string }[] = [];
  for (let [routeName, routeFiles] of appFiles.routeFiles.children) {
    splitRoute(
      routeName,
      routeFiles,
      resolver.options.splitAtRoutes,
      (_: string, filename: string) => {
        requiredAppFiles.push([filename]);
      },
      (routeNames: string[]) => {
        lazyRoutes.push({
          names: routeNames,
          path: `@embroider/core/route/${encodeURIComponent(routeNames[0])}`,
        });
      }
    );
  }

  let [fastboot, nonFastboot] = partition(excludeDotFiles(flatten(requiredAppFiles)), file =>
    appFiles.isFastbootOnly.get(file)
  );

  let amdModules = nonFastboot.map(file => importPaths(resolver, appFiles, file));
  let fastbootOnlyAmdModules = fastboot.map(file => importPaths(resolver, appFiles, file));

  let params = {
    amdModules,
    fastbootOnlyAmdModules,
    lazyRoutes,
    lazyEngines,
    eagerModules,
    styles,
    // this is a backward-compatibility feature: addons can force inclusion of modules.
    defineModulesFrom: './-embroider-implicit-modules.js',
  };

  return {
    src: entryTemplate(params),
    watches: [fromDir],
  };
}

const entryTemplate = compile(`
import { macroCondition, getGlobalConfig } from '@embroider/macros';

{{#if styles}}
  if (macroCondition(!getGlobalConfig().fastboot?.isRunning)) {
    {{#each styles as |stylePath| ~}}
      await import("{{js-string-escape stylePath.path}}");
    {{/each}}
  }
{{/if}}

{{#if defineModulesFrom ~}}
  import implicitModules from "{{js-string-escape defineModulesFrom}}";
{{/if}}

{{#each eagerModules as |eagerModule| ~}}
  import "{{js-string-escape eagerModule}}";
{{/each}}

{{#each amdModules as |amdModule index| ~}}
  import * as amdModule{{index}} from "{{js-string-escape amdModule.buildtime}}"
{{/each}}

let exportFastbootModules = {};

{{#if fastbootOnlyAmdModules}}
  if (macroCondition(getGlobalConfig().fastboot?.isRunning)) {
    let fastbootModules = {};

    {{#each fastbootOnlyAmdModules as |amdModule| ~}}
      fastbootModules["{{js-string-escape amdModule.runtime}}"] = import("{{js-string-escape amdModule.buildtime}}");
    {{/each}}

    const resolvedValues = await Promise.all(Object.values(fastbootModules));

    Object.keys(fastbootModules).forEach((k, i) => {
      exportFasbootModules[k] = resolvedValues[i];
    })
  }
{{/if}}


{{#if lazyRoutes}}
window._embroiderRouteBundles_ = [
  {{#each lazyRoutes as |route|}}
  {
    names: {{json-stringify route.names}},
    load: function() {
      return import("{{js-string-escape route.path}}");
    }
  },
  {{/each}}
]
{{/if}}

{{#if lazyEngines}}
window._embroiderEngineBundles_ = [
  {{#each lazyEngines as |engine|}}
  {
    names: {{json-stringify engine.names}},
    load: function() {
      return import("{{js-string-escape engine.path}}");
    }
  },
  {{/each}}
]
{{/if}}

export default Object.assign(
  {},
  implicitModules,
  {
    {{#each amdModules as |amdModule index| ~}}
      "{{js-string-escape amdModule.runtime}}": amdModule{{index}},
    {{/each}}
  },
  exportFastbootModules
);
`) as (params: {
  amdModules: { runtime: string; buildtime: string }[];
  fastbootOnlyAmdModules?: { runtime: string; buildtime: string }[];
  defineModulesFrom?: string;
  eagerModules?: string[];
  lazyRoutes?: { names: string[]; path: string }[];
  lazyEngines?: { names: string[]; path: string }[];
  styles?: { path: string }[];
}) => string;

function excludeDotFiles(files: string[]) {
  return files.filter(file => !file.startsWith('.') && !file.includes('/.'));
}

export function importPaths(resolver: Resolver, { engine }: AppFiles, engineRelativePath: string) {
  let resolvableExtensionsPattern = extensionsPattern(resolver.options.resolvableExtensions);
  let noHBS = engineRelativePath.replace(resolvableExtensionsPattern, '').replace(/\.hbs$/, '');
  return {
    runtime: `${engine.modulePrefix}/${noHBS}`,
    buildtime: `./${engineRelativePath}`,
  };
}

export function splitRoute(
  routeName: string,
  files: RouteFiles,
  splitAtRoutes: (RegExp | string)[] | undefined,
  addToParent: (routeName: string, filename: string) => void,
  addLazyBundle: (routeNames: string[], files: string[]) => void
) {
  let shouldSplit = routeName && shouldSplitRoute(routeName, splitAtRoutes);
  let ownFiles = [];
  let ownNames = new Set() as Set<string>;

  if (files.template) {
    if (shouldSplit) {
      ownFiles.push(files.template);
      ownNames.add(routeName);
    } else {
      addToParent(routeName, files.template);
    }
  }

  if (files.controller) {
    if (shouldSplit) {
      ownFiles.push(files.controller);
      ownNames.add(routeName);
    } else {
      addToParent(routeName, files.controller);
    }
  }

  if (files.route) {
    if (shouldSplit) {
      ownFiles.push(files.route);
      ownNames.add(routeName);
    } else {
      addToParent(routeName, files.route);
    }
  }

  for (let [childName, childFiles] of files.children) {
    splitRoute(
      `${routeName}.${childName}`,
      childFiles,
      splitAtRoutes,
      (childRouteName: string, childFile: string) => {
        // this is our child calling "addToParent"
        if (shouldSplit) {
          ownFiles.push(childFile);
          ownNames.add(childRouteName);
        } else {
          addToParent(childRouteName, childFile);
        }
      },
      (routeNames: string[], files: string[]) => {
        addLazyBundle(routeNames, files);
      }
    );
  }

  if (ownFiles.length > 0) {
    addLazyBundle([...ownNames], ownFiles);
  }
}

function shouldSplitRoute(routeName: string, splitAtRoutes: (RegExp | string)[] | undefined) {
  if (!splitAtRoutes) {
    return false;
  }
  return splitAtRoutes.find(pattern => {
    if (typeof pattern === 'string') {
      return pattern === routeName;
    } else {
      return pattern.test(routeName);
    }
  });
}

export function getAppFiles(appRoot: string): Set<string> {
  const files: string[] = walkSync(appRoot, {
    ignore: ['_babel_filter_.js', 'app.js', 'assets', 'testem.js', 'node_modules'],
  });
  return new Set(files);
}

export function getFastbootFiles(appRoot: string): Set<string> {
  const appDirPath = join(appRoot, '_fastboot_');
  const files: string[] = walkSync(appDirPath);
  return new Set(files);
}
