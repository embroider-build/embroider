import { type Package, locateEmbroiderWorkingDir } from '@embroider/shared-internals';
import type { V2AddonPackage } from '@embroider/shared-internals/src/package';
import { lstatSync, readFileSync, readJSONSync } from 'fs-extra';
import { sortBy } from 'lodash';
import { join } from 'path';
import resolve from 'resolve';
import type { Engine } from './app-files';
import type { Resolver } from './module-resolver';
import type { VirtualContentResult } from './virtual-content';

export function decodeVirtualVendor(filename: string): boolean {
  return filename.endsWith('-embroider-vendor.js');
}

export function renderVendor(filename: string, resolver: Resolver): VirtualContentResult {
  const owner = resolver.packageCache.ownerOfFile(filename);
  if (!owner) {
    throw new Error(`Failed to find a valid owner for ${filename}`);
  }
  return { src: getVendor(owner, resolver, filename), watches: [] };
}

function getVendor(owner: Package, resolver: Resolver, filename: string): string {
  let engineConfig = resolver.owningEngine(owner);
  let engine: Engine = {
    package: owner,
    addons: new Map(
      engineConfig.activeAddons.map(addon => [
        resolver.packageCache.get(addon.root) as V2AddonPackage,
        addon.canResolveFromFile,
      ])
    ),
    isApp: true,
    modulePrefix: resolver.options.modulePrefix,
    appRelativePath: 'NOT_USED_DELETE_ME',
  };

  let path = join(locateEmbroiderWorkingDir(resolver.options.appRoot), 'ember-env.json');
  if (!lstatSync(path).isFile()) {
    throw new Error(`Failed to read the ember-env.json when generating content for ${filename}`);
  }
  let emberENV = readJSONSync(path);

  return generateVendor(engine, emberENV);
}

function generateVendor(engine: Engine, emberENV?: unknown): string {
  // Add addons implicit-scripts
  let vendor: string[] = impliedAddonVendors(engine).map((sourcePath: string): string => {
    let source = readFileSync(sourcePath);
    return `${source}`;
  });
  // Add _testing_prefix_.js
  vendor.unshift(`var runningTests=false;`);
  // Add _ember_env_.js
  vendor.unshift(`window.EmberENV={ ...(window.EmberENV || {}), ...${JSON.stringify(emberENV, null, 2)} };`);
  // Add _loader_.js
  vendor.push(`loader.makeDefaultExport=false;`);

  return vendor.join('') as string;
}

function impliedAddonVendors(engine: Engine): string[] {
  let result: Array<string> = [];
  for (let addon of sortBy(Array.from(engine.addons.keys()), pkg => {
    switch (pkg.name) {
      case 'loader.js':
        return 0;
      case 'ember-source':
        return 10;
      default:
        return 1000;
    }
  })) {
    let implicitScripts = addon.meta['implicit-scripts'];
    if (implicitScripts) {
      let options = { basedir: addon.root };
      for (let mod of implicitScripts) {
        result.push(resolve.sync(mod, options));
      }
    }
  }
  return result;
}
