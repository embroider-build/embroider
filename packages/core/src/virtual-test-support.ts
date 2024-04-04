import type { Package } from '@embroider/shared-internals';
import type { V2AddonPackage } from '@embroider/shared-internals/src/package';
import { readFileSync } from 'fs';
import resolve from 'resolve';
import type { Engine } from './app-files';
import type { Resolver } from './module-resolver';
import type { VirtualContentResult } from './virtual-content';

export function decodeImplicitTestScripts(filename: string): boolean {
  return filename.endsWith('-embroider-test-support.js');
}

export function renderImplicitTestScripts(filename: string, resolver: Resolver): VirtualContentResult {
  const owner = resolver.packageCache.ownerOfFile(filename);
  if (!owner) {
    throw new Error(`Failed to find a valid owner for ${filename}`);
  }
  return { src: getTestSupport(owner, resolver), watches: [] };
}

function getTestSupport(owner: Package, resolver: Resolver): string {
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

  return generateTestSupport(engine);
}

function generateTestSupport(engine: Engine): string {
  // Add classic addons test-support
  let result: string[] = impliedAddonTestSupport(engine);
  let hasEmbroiderMacrosTestSupport = result.find(sourcePath =>
    sourcePath.endsWith('embroider-macros-test-support.js')
  );
  result = result.map((sourcePath: string): string => {
    let source = readFileSync(sourcePath);
    return `${source}`;
  });

  // Add _testing_suffix_.js
  result.push(`
var runningTests=true;
if (typeof Testem !== 'undefined' && (typeof QUnit !== 'undefined' || typeof Mocha !== 'undefined')) {
  Testem.hookIntoTestFramework();
}`);

  // whether or not anybody was actually using @embroider/macros explicitly
  // as an addon, we ensure its test-support file is always present.
  if (!hasEmbroiderMacrosTestSupport) {
    result.unshift(`${readFileSync(require.resolve('@embroider/macros/src/vendor/embroider-macros-test-support'))}`);
  }

  return result.join('') as string;
}

function impliedAddonTestSupport(engine: Engine): string[] {
  let result: Array<string> = [];
  for (let addon of Array.from(engine.addons.keys())) {
    let implicitScripts = addon.meta['implicit-test-scripts'];
    if (implicitScripts) {
      let options = { basedir: addon.root };
      for (let mod of implicitScripts) {
        result.push(resolve.sync(mod, options));
      }
    }
  }
  return result;
}
