import { explicitRelative, RewrittenPackageCache, type AddonPackage, type Package } from '@embroider/shared-internals';
import type { Engine } from './app-files';
import { resolve as resolvePath } from 'path';
import { realpathSync } from 'fs-extra';
import flatMap from 'lodash/flatMap';

export interface Options {
  renamePackages: {
    [fromName: string]: string;
  };
  renameModules: {
    [fromName: string]: string;
  };
  resolvableExtensions: string[];
  appRoot: string;
  engines: EngineConfig[];
  modulePrefix: string;
  splitAtRoutes?: (RegExp | string)[];
  podModulePrefix?: string;
  staticAppPaths: string[];
  emberVersion: string;
}

export interface EngineConfig {
  packageName: string;
  activeAddons: { name: string; root: string; canResolveFromFile: string }[];
  fastbootFiles: { [appName: string]: { localFilename: string; shadowedFilename: string | undefined } };
  root: string;
  isLazy: boolean;
}

export function buildResolverOptions<T extends Options>(inputs: {
  appPackage?: Package;
  extraDeps?: Map<string, AddonPackage[]>;
  modulePrefix?: string;
  podModulePrefix?: string;
  splitAtRoutes?: (RegExp | string)[];
  staticAppPaths?: string[];
  extend?: (opts: T, allActiveAddons: AddonPackage[]) => T;
}): T {
  let appPackage: Package;
  if (inputs.appPackage) {
    appPackage = inputs.appPackage;
  } else {
    let packageCache = RewrittenPackageCache.shared('embroider', process.cwd());
    appPackage = packageCache.get(packageCache.appRoot);
  }

  let extraDeps = inputs.extraDeps ?? new Map();

  let allActiveAddons: AddonPackage[] = findAllActiveAddons(appPackage, extraDeps);
  let renamePackages = Object.assign({}, ...allActiveAddons.map(dep => dep.meta['renamed-packages']));
  let renameModules = Object.assign({}, ...allActiveAddons.map(dep => dep.meta['renamed-modules']));
  let modulePrefix = appPackage.name;
  let engines = partitionEngines(appPackage, modulePrefix, extraDeps);

  let output: Options = {
    renamePackages,
    renameModules,
    resolvableExtensions: resolvableExtensions(),
    appRoot: appPackage.root,
    engines,
    modulePrefix,
    staticAppPaths: inputs.staticAppPaths ?? [],
    emberVersion: appPackage.dependencies.find(d => d.name === 'ember-source')!.version,
    splitAtRoutes: inputs.splitAtRoutes,
    podModulePrefix: inputs.podModulePrefix,
  };

  if (inputs.extend) {
    return inputs.extend(output as T, allActiveAddons);
  }
  return output as T;
}

function resolvableExtensions(): string[] {
  let fromEnv = process.env.EMBROIDER_RESOLVABLE_EXTENSIONS;
  if (fromEnv) {
    return fromEnv.split(',');
  } else {
    return ['.mjs', '.gjs', '.js', '.mts', '.gts', '.ts', '.hbs', '.hbs.js', '.json'];
  }
}

function partitionEngines(
  appPackage: Package,
  modulePrefix: string,
  extraDeps: Map<string, AddonPackage[]>
): EngineConfig[] {
  let queue: Engine[] = [
    {
      package: appPackage,
      addons: new Map(),
      isApp: true,
      modulePrefix,
      appRelativePath: '.',
    },
  ];
  let done: Engine[] = [];
  let seenEngines: Set<Package> = new Set();
  while (true) {
    let current = queue.shift();
    if (!current) {
      break;
    }
    findActiveAddons(current.package, current, extraDeps);
    for (let addon of current.addons.keys()) {
      if (addon.isEngine() && !seenEngines.has(addon)) {
        seenEngines.add(addon);
        queue.push({
          package: addon,
          addons: new Map(),
          isApp: !current,
          modulePrefix: addon.name,
          appRelativePath: explicitRelative(appPackage.root, addon.root),
        });
      }
    }
    done.push(current);
  }

  return done.map(engine => ({
    packageName: engine.package.name,
    // we need to use the real path here because webpack requests always use the real path i.e. follow symlinks
    root: realpathSync(engine.package.root),
    fastbootFiles: {},
    activeAddons: [...engine.addons]
      .map(([addon, canResolveFromFile]) => ({
        name: addon.name,
        root: addon.root,
        canResolveFromFile,
      }))
      // the traditional order is the order in which addons will run, such
      // that the last one wins. Our resolver's order is the order to
      // search, so first one wins.
      .reverse(),
    isLazy: engine.package.isLazyEngine(),
  }));
}

// recurse to find all active addons that don't cross an engine boundary.
// Inner engines themselves will be returned, but not those engines' children.
// The output set's insertion order is the proper ember-cli compatible
// ordering of the addons.
function findActiveAddons(pkg: Package, engine: Engine, extraDeps: Map<string, AddonPackage[]>, isChild = false): void {
  for (let child of activeAddonChildren(pkg, extraDeps)) {
    if (engine.addons.has(child)) {
      continue;
    }
    if (!child.isEngine()) {
      findActiveAddons(child, engine, extraDeps, true);
    }
    let canResolveFrom = resolvePath(pkg.root, 'package.json');
    engine.addons.set(child, canResolveFrom);
  }
  // ensure addons are applied in the correct order, if set (via @embroider/compat/v1-addon)
  if (!isChild) {
    engine.addons = new Map(
      [...engine.addons].sort(([a], [b]) => {
        return (a.meta['order-index'] || 0) - (b.meta['order-index'] || 0);
      })
    );
  }
}

function activeAddonChildren(pkg: Package, extraDeps: Map<string, AddonPackage[]>): AddonPackage[] {
  let result = (pkg.dependencies.filter(isActiveAddon) as AddonPackage[]).filter(
    // When looking for child addons, we want to ignore 'peerDependencies' of
    // a given package, to align with how ember-cli resolves addons. So here
    // we only include dependencies that are definitely active due to one of
    // the other sections.
    addon => pkg.categorizeDependency(addon.name) !== 'peerDependencies'
  );
  let extras = extraDeps.get(pkg.root);
  if (extras) {
    result = [...result, ...extras];
  }
  return result.sort(orderAddons);
}

function isActiveAddon(pkg: Package): boolean {
  // stage1 already took care of converting everything that's actually active
  // into v2 addons. If it's not a v2 addon, we don't want it.
  //
  // We can encounter v1 addons here when there is inactive stuff floating
  // around in the node_modules that accidentally satisfy something like an
  // optional peer dep.
  return pkg.isV2Addon();
}

function orderAddons(depA: Package, depB: Package): number {
  let depAIdx = 0;
  let depBIdx = 0;

  if (depA && depA.meta && depA.isV2Addon()) {
    depAIdx = depA.meta['order-index'] || 0;
  }
  if (depB && depB.meta && depB.isV2Addon()) {
    depBIdx = depB.meta['order-index'] || 0;
  }

  return depAIdx - depBIdx;
}

function findAllActiveAddons(appPackage: Package, extraDeps: Map<string, AddonPackage[]>): AddonPackage[] {
  let result = appPackage.findDescendants(isActiveAddon) as AddonPackage[];
  let extras = extraDeps.get(appPackage.root);
  if (extras) {
    let extraDescendants = flatMap(extras, dep => dep.findDescendants(isActiveAddon)) as AddonPackage[];
    result = [...result, ...extras, ...extraDescendants];
  }
  return result.sort(orderAddons);
}
