import type { Package } from '@embroider/shared-internals';
import type { V2AddonPackage } from '@embroider/shared-internals/src/package';
import { readFileSync } from 'fs';
import { resolve as pathResolve } from 'path';
import { sortBy } from 'lodash';
import resolve from 'resolve';
import type { Resolver } from './module-resolver';
import type { VirtualContentResult } from './virtual-content';
import type { Engine } from './app-files';

export interface VirtualVendorStylesResponse {
  type: 'vendor-css';
  specifier: string;
}

export function virtualVendorStyles(pkg: Package): VirtualVendorStylesResponse {
  return { type: 'vendor-css', specifier: pathResolve(pkg.root, '-embroider-vendor-styles.css') };
}

export function decodeVirtualVendorStyles(filename: string): boolean {
  return filename.endsWith('-embroider-vendor-styles.css');
}

export function renderVendorStyles(response: VirtualVendorStylesResponse, resolver: Resolver): VirtualContentResult {
  const filename = response.specifier;
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
    isApp: engineConfig.root === resolver.options.engines[0].root,
    modulePrefix: resolver.options.modulePrefix,
    appRelativePath: 'NOT_USED_DELETE_ME',
  };

  return generateVendorStyles(engine);
}

function generateVendorStyles(engine: Engine): string {
  let result: string[] = impliedAddonVendorStyles(engine).map(sourcePath => readFileSync(sourcePath, 'utf-8'));

  // add the engines own styles but only if it is not the top-level app, that is provided by @embroider/synthesized-styles
  if (!engine.isApp) {
    let engineStyles = [];

    engineStyles = getAddonImplicitStyles(engine.package as V2AddonPackage).map(sourcePath =>
      readFileSync(sourcePath, 'utf-8')
    );

    // add engine's own implicit styles after all vendor styles
    if (engineStyles.length) {
      result = [...result, ...engineStyles];
    }
  }

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
    // exclude lazy engines because they will handle their own css importation
    if (addon.isLazyEngine()) {
      continue;
    }

    let styles = getAddonImplicitStyles(addon);

    if (styles.length) {
      result = [...styles, ...result];
    }
  }
  return result;
}

function getAddonImplicitStyles(pkg: V2AddonPackage): string[] {
  let implicitStyles = pkg.meta['implicit-styles'];
  let styles = [];
  if (implicitStyles) {
    let options = { basedir: pkg.root };
    for (let mod of implicitStyles) {
      styles.push(resolve.sync(mod, options));
    }
  }
  return styles;
}
