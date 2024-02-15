import type { Package } from '@embroider/shared-internals';
import type { V2AddonPackage } from '@embroider/shared-internals/src/package';
import { readFileSync } from 'fs';
import { sortBy } from 'lodash';
import resolve from 'resolve';
import type { Resolver } from './module-resolver';
import type { VirtualContentResult } from './virtual-content';
import type { Engine } from './app-files';

export function decodeVirtualVendorStyles(filename: string): boolean {
  return filename.endsWith('-embroider-vendor-styles.css');
}

export function renderVendorStyles(filename: string, resolver: Resolver): VirtualContentResult {
  const owner = resolver.packageCache.ownerOfFile(filename);
  if (!owner) {
    throw new Error(`Failed to find a valid owner for ${filename}`);
  }
  return { src: getVendorStyles(owner, resolver), watches: [] };
}

function getVendorStyles(owner: Package, resolver: Resolver): string {
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

  return generateVendorStyles(engine);
}

function generateVendorStyles(engine: Engine): string {
  let result: string[] = impliedAddonVendorStyles(engine).map((sourcePath: string): string => {
    let source = readFileSync(sourcePath);
    return `${source}`;
  });

  return result.join('') as string;
}

function impliedAddonVendorStyles(engine: Engine): string[] {
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
    let implicitStyles = addon.meta['implicit-styles'];
    if (implicitStyles) {
      let styles = [];
      let options = { basedir: addon.root };
      for (let mod of implicitStyles) {
        // exclude engines because they will handle their own css importation
        if (!addon.isLazyEngine()) {
          styles.push(resolve.sync(mod, options));
        }
      }
      if (styles.length) {
        result = [...styles, ...result];
      }
    }
  }
  return result;
}
