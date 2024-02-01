import { AppFiles, type RouteFiles } from './app-files';
import { compile } from './js-handlebars';
import type { Resolver } from './module-resolver';
import type { CompatResolverOptions } from '../../compat/src/resolver-transform';
import { flatten, partition, sortBy } from 'lodash';
import { posix, join, dirname } from 'path';
import { type AddonMeta, explicitRelative, type Package, extensionsPattern } from '@embroider/shared-internals';
import type { ImplicitAssetPaths } from './asset';
import { sync as resolveSync } from 'resolve';
import { type default as Options, optionsWithDefaults } from './options';
import walkSync from 'walk-sync';
import type { V2AddonPackage } from '@embroider/shared-internals/src/package';

const entrypointPattern = /(?<filename>.*)[\\/]-embroider-entrypoint.js/;

export function decodeEntrypoint(filename: string): { fromFile: string } | undefined {
  // Performance: avoid paying regex exec cost unless needed
  if (!filename.includes('-embroider-entrypoint')) {
    return;
  }
  let m = entrypointPattern.exec(filename);
  if (m) {
    return {
      fromFile: m.groups!.filename,
    };
  }
}

export function renderEntrypoint(
  resolver: Resolver,
  { fromFile }: { fromFile: string }
): { src: string; watches: string[] } {
  // this is new
  const owner = resolver.packageCache.ownerOfFile(fromFile);

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
    getAppFiles(owner.root),
    hasFastboot ? getFastbootFiles(owner.root) : new Set(),
    extensionsPattern(resolver.options.resolvableExtensions),
    resolver.options.podModulePrefix
  );

  let options = (resolver.options as CompatResolverOptions).options;

  let requiredAppFiles = [appFiles.otherAppFiles];
  if (!options.staticComponents) {
    requiredAppFiles.push(appFiles.components);
  }
  if (!options.staticHelpers) {
    requiredAppFiles.push(appFiles.helpers);
  }
  if (!options.staticModifiers) {
    requiredAppFiles.push(appFiles.modifiers);
  }

  let styles = [];
  // only import styles from engines with a parent (this excludeds the parent application) as their styles
  // will be inserted via a direct <link> tag.
  if (!appFiles.engine.isApp && appFiles.engine.package.isLazyEngine()) {
    let implicitStyles = impliedAddonAssets('implicit-styles', appFiles);
    for (let style of implicitStyles) {
      styles.push({
        path: explicitRelative(dirname(fromFile), style),
      });
    }

    let engineMeta = appFiles.engine.package.meta as AddonMeta;
    if (engineMeta && engineMeta['implicit-styles']) {
      for (let style of engineMeta['implicit-styles']) {
        styles.push({
          path: explicitRelative(dirname(fromFile), style),
        });
      }
    }
  }

  let lazyEngines: { names: string[]; path: string }[] = [];

  if (isApp) {
    // deliberately ignoring the app
    let [, ...childEngines] = resolver.options.engines;
    for (let childEngine of childEngines) {
      let target = `${childEngine.packageName}/-embroider-entrypoint.js`;

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
      (_: string, filename: string) => {
        requiredAppFiles.push([filename]);
      },
      (routeNames: string[], _files: string[]) => {
        // TODO: we don't consume files anymore, should we stop generating it?
        let routeEntrypoint = `assets/_route_/${encodeURIComponent(routeNames[0])}.js`;
        lazyRoutes.push({
          names: routeNames,
          path: importPaths(resolver, appFiles, routeEntrypoint).buildtime,
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

  // for the top-level entry template we need to pass extra params to the template
  // this is new, it used to be passed into the appJS function instead
  if (isApp) {
    // TODO figure out how to actually translate these
    // Object.assign(params, {
    //   autoRun: this.compatApp.autoRun,
    //   appBoot: !this.compatApp.autoRun ? this.compatApp.appBoot.readAppBoot() : '',
    //   mainModule: explicitRelative(dirname(relativePath), 'app'),
    //   appConfig: this.configTree.readConfig().APP,
    // });
    Object.assign(params, {
      autoRun: true,
      appBoot: '',
      mainModule: './app.js',
      appConfig: {},
    });
  }

  return {
    src: entryTemplate(params),
    watches: [],
  };
}

const entryTemplate = compile(`
import { importSync as i, macroCondition, getGlobalConfig } from '@embroider/macros';
let w = window;
let d = w.define;

{{#if styles}}
  if (macroCondition(!getGlobalConfig().fastboot?.isRunning)) {
    {{#each styles as |stylePath| ~}}
      await import("{{js-string-escape stylePath.path}}");
    {{/each}}
  }
{{/if}}

{{#if defineModulesFrom ~}}
  import implicitModules from "{{js-string-escape defineModulesFrom}}";

  for(const [name, module] of Object.entries(implicitModules)) {
    d(name, function() { return module });
  }
{{/if}}


{{#each eagerModules as |eagerModule| ~}}
  import "{{js-string-escape eagerModule}}";
{{/each}}

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


{{#if lazyRoutes}}
w._embroiderRouteBundles_ = [
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
w._embroiderEngineBundles_ = [
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

{{#if autoRun ~}}
if (!runningTests) {
  i("{{js-string-escape mainModule}}").default.create({{json-stringify appConfig}});
}
{{else  if appBoot ~}}
  {{ appBoot }}
{{/if}}

{{#if testSuffix ~}}
  {{!- TODO: both of these suffixes should get dynamically generated so they incorporate
       any content-for added by addons. -}}


  {{!- this is the traditional tests-suffix.js -}}
  i('../tests/test-helper');
  EmberENV.TESTS_FILE_LOADED = true;
{{/if}}
`) as (params: {
  amdModules: { runtime: string; buildtime: string }[];
  fastbootOnlyAmdModules?: { runtime: string; buildtime: string }[];
  defineModulesFrom?: string;
  eagerModules?: string[];
  autoRun?: boolean;
  appBoot?: string;
  mainModule?: string;
  appConfig?: unknown;
  testSuffix?: boolean;
  lazyRoutes?: { names: string[]; path: string }[];
  lazyEngines?: { names: string[]; path: string }[];
  styles?: { path: string }[];
}) => string;

function excludeDotFiles(files: string[]) {
  return files.filter(file => !file.startsWith('.') && !file.includes('/.'));
}

function importPaths(resolver: Resolver, { engine }: AppFiles, engineRelativePath: string) {
  let resolvableExtensionsPattern = extensionsPattern(resolver.options.resolvableExtensions);
  let noHBS = engineRelativePath.replace(resolvableExtensionsPattern, '').replace(/\.hbs$/, '');
  return {
    runtime: `${engine.modulePrefix}/${noHBS}`,
    buildtime: posix.join(engine.package.name, engineRelativePath),
  };
}

function impliedAddonAssets(type: keyof ImplicitAssetPaths, { engine }: AppFiles): string[] {
  let result: Array<string> = [];
  for (let addon of sortBy(Array.from(engine.addons.keys()), scriptPriority)) {
    let implicitScripts = addon.meta[type];
    if (implicitScripts) {
      let styles = [];
      let options = { basedir: addon.root };
      for (let mod of implicitScripts) {
        if (type === 'implicit-styles') {
          // exclude engines because they will handle their own css importation
          if (!addon.isLazyEngine()) {
            styles.push(resolveSync(mod, options));
          }
        } else {
          result.push(resolveSync(mod, options));
        }
      }
      if (styles.length) {
        result = [...styles, ...result];
      }
    }
  }
  return result;
}

function scriptPriority(pkg: Package) {
  switch (pkg.name) {
    case 'loader.js':
      return 0;
    case 'ember-source':
      return 10;
    default:
      return 1000;
  }
}

function splitRoute(
  routeName: string,
  files: RouteFiles,
  addToParent: (routeName: string, filename: string) => void,
  addLazyBundle: (routeNames: string[], files: string[]) => void
) {
  let shouldSplit = routeName && shouldSplitRoute(routeName);
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

function readEmbroiderConfig(): Required<Options> {
  // TODO
  return optionsWithDefaults({});
}

function shouldSplitRoute(routeName: string) {
  let config = readEmbroiderConfig();
  return (
    !config.splitAtRoutes ||
    config.splitAtRoutes.find(pattern => {
      if (typeof pattern === 'string') {
        return pattern === routeName;
      } else {
        return pattern.test(routeName);
      }
    })
  );
}

function getAppFiles(appRoot: string): Set<string> {
  const files: string[] = walkSync(appRoot, {
    ignore: ['_babel_config_.js', '_babel_filter_.js', 'app.js', 'assets', 'testem.js', 'node_modules'],
  });
  return new Set(files);
}

function getFastbootFiles(appRoot: string): Set<string> {
  const appDirPath = join(appRoot, '_fastboot_');
  const files: string[] = walkSync(appDirPath);
  return new Set(files);
}
