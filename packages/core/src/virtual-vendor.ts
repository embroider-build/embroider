import { type Package, extensionsPattern } from '@embroider/shared-internals';
import type { V2AddonPackage } from '@embroider/shared-internals/src/package';
import { readFileSync } from 'fs';
import { sortBy } from 'lodash';
import { join } from 'path';
import resolve from 'resolve';
import walkSync from 'walk-sync';
import { AppFiles } from './app-files';
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
  return { src: getVendor(owner, resolver), watches: [] };
}

function getVendor(owner: Package, resolver: Resolver): string {
  let engine = resolver.owningEngine(owner);
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
      isApp: true,
      modulePrefix: resolver.options.modulePrefix,
      appRelativePath: 'NOT_USED_DELETE_ME',
    },
    getAppFiles(owner.root),
    hasFastboot ? getFastbootFiles(owner.root) : new Set(),
    extensionsPattern(resolver.options.resolvableExtensions),
    resolver.options.podModulePrefix
  );

  // TODO - From where do we get this dynamically? in compat-app-builder:
  // let emberENV = this.configTree.readConfig().EmberENV;
  const emberENV = {
    EXTEND_PROTOTYPES: false,
    FEATURES: {},
    _APPLICATION_TEMPLATE_WRAPPER: false,
    _DEFAULT_ASYNC_OBSERVERS: true,
    _JQUERY_INTEGRATION: false,
    _TEMPLATE_ONLY_GLIMMER_COMPONENTS: true,
  };

  return generateVendor(appFiles, emberENV);
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

function generateVendor(engine: AppFiles, emberENV?: unknown): string {
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

function impliedAddonVendors({ engine }: AppFiles): string[] {
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
