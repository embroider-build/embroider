import { type Package, locateEmbroiderWorkingDir } from '@embroider/shared-internals';
import type { V2AddonPackage } from '@embroider/shared-internals/src/package';
import { lstatSync, readFileSync, readJSONSync } from 'fs-extra';
import { join } from 'path';
import resolve from 'resolve';
import type { Resolver } from './module-resolver';
import type { VirtualContentResult } from './virtual-content';

export interface VirtualVendorResponse {
  type: 'vendor-js';
  specifier: string;
}

export function renderVendor(response: VirtualVendorResponse, resolver: Resolver): VirtualContentResult {
  const owner = resolver.packageCache.ownerOfFile(response.specifier);
  if (!owner) {
    throw new Error(`Failed to find a valid owner for ${response.specifier}`);
  }
  return { src: getVendor(owner, resolver, response.specifier), watches: [] };
}

function getVendor(owner: Package, resolver: Resolver, filename: string): string {
  let engineConfig = resolver.owningEngine(owner);
  let addons = engineConfig.activeAddons.map(addon => resolver.packageCache.get(addon.root) as V2AddonPackage);

  let path = join(locateEmbroiderWorkingDir(resolver.options.appRoot), 'ember-env.json');
  if (!lstatSync(path).isFile()) {
    throw new Error(`Failed to read the ember-env.json when generating content for ${filename}`);
  }
  let emberENV = readJSONSync(path);

  return generateVendor(addons, emberENV);
}

function generateVendor(addons: V2AddonPackage[], emberENV?: unknown): string {
  // Add addons implicit-scripts
  let vendor: string[] = impliedAddonVendors(addons).map((sourcePath: string): string => {
    let source = readFileSync(sourcePath);
    return `${source}`;
  });
  // Add _testing_prefix_.js
  vendor.unshift(`var runningTests=false;`);
  // Add _ember_env_.js
  vendor.unshift(`window.EmberENV={ ...(window.EmberENV || {}), ...${JSON.stringify(emberENV, null, 2)} };`);

  return vendor.join('') as string;
}

function impliedAddonVendors(addons: V2AddonPackage[]): string[] {
  let result: Array<string> = [];
  for (let addon of addons) {
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
