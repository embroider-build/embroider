import type { Package } from '@embroider/shared-internals';
import type { V2AddonPackage } from '@embroider/shared-internals/src/package';
import { readFileSync } from 'fs';
import { sortBy } from 'lodash';
import resolve from 'resolve';
import type { Engine } from './app-files';
import type { Resolver } from './module-resolver';
import type { VirtualContentResult } from './virtual-content';

export interface TestSupportStylesResponse {
  type: 'test-support-css';
  specifier: string;
}

export function renderTestSupportStyles(response: TestSupportStylesResponse, resolver: Resolver): VirtualContentResult {
  const filename = response.specifier;
  const owner = resolver.packageCache.ownerOfFile(filename);
  if (!owner) {
    throw new Error(`Failed to find a valid owner for ${filename}`);
  }
  return { src: getTestSupportStyles(owner, resolver), watches: [] };
}

function getTestSupportStyles(owner: Package, resolver: Resolver): string {
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

  return generateTestSupportStyles(engine);
}

function generateTestSupportStyles(engine: Engine): string {
  let result: string[] = impliedAddonTestSupportStyles(engine).map((sourcePath: string): string => {
    let source = readFileSync(sourcePath);
    return `${source}`;
  });

  return result.join('') as string;
}

function impliedAddonTestSupportStyles(engine: Engine): string[] {
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
    let implicitStyles = addon.meta['implicit-test-styles'];
    if (implicitStyles) {
      let options = { basedir: addon.root };
      for (let mod of implicitStyles) {
        result.push(resolve.sync(mod, options));
      }
    }
  }
  return result;
}
