import type { VirtualContentResult } from './virtual-content';
import type { Resolver } from './module-resolver';
import { explicitRelative, type Package, extensionsPattern } from '@embroider/shared-internals';
import { AppFiles } from './app-files';
import type { V2AddonPackage } from '@embroider/shared-internals/src/package';
import walkSync from 'walk-sync';
import { join } from 'path';
import type { InMemoryAsset, OnDiskAsset } from './asset';
// import SourceMapConcat from 'fast-sourcemap-concat';
import { readFileSync, statSync } from 'fs';
import { sortBy } from 'lodash';
import resolve from 'resolve';

class ConcatenatedAsset {
  kind: 'concatenated-asset' = 'concatenated-asset';
  constructor(
    public relativePath: string,
    public sources: (OnDiskAsset | InMemoryAsset)[],
    private resolvableExtensions: RegExp
  ) {}
  get sourcemapPath() {
    return this.relativePath.replace(this.resolvableExtensions, '') + '.map';
  }
}

export function decodeVirtualVendor(filename: string): boolean {
  return filename.endsWith('-embroider-vendor.js');
}

export function renderVendor(filename: string, resolver: Resolver): VirtualContentResult {
  const vendorScript = vendorContents(filename, resolver);
  return { src: `${vendorScript}`, watches: [] };
}

function vendorContents(fromFile: string, resolver: Resolver) {
  const owner = resolver.packageCache.ownerOfFile(fromFile);
  if (!owner) {
    throw new Error(`Failed to find a valid owner for ${fromFile}`);
  }
  // TODO: Rebuild the vendor generated in the rewritten-app instead of reading it
  let asset = implicitScriptsAsset(owner, resolver);
  if (asset) {
    let finalAsset = updateImplicitScriptAssetSync(asset);
    return finalAsset;
  }
  return undefined;
}

function implicitScriptsAsset(owner: Package, resolver: Resolver) {
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

  // TODO - From where do I get this dynamically?
  // let emberENV = this.configTree.readConfig().EmberENV;
  const emberENV = {
    EXTEND_PROTOTYPES: false,
    FEATURES: {},
    _APPLICATION_TEMPLATE_WRAPPER: false,
    _DEFAULT_ASYNC_OBSERVERS: true,
    _JQUERY_INTEGRATION: false,
    _TEMPLATE_ONLY_GLIMMER_COMPONENTS: true,
  };

  let asset;
  let implicitScripts = impliedAssets(appFiles, owner.root, emberENV);
  if (implicitScripts.length > 0) {
    asset = new ConcatenatedAsset('assets/vendor.js', implicitScripts, /\.js/);
  }
  return asset;
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

function impliedAssets(engine: AppFiles, root: string, emberENV?: unknown): (OnDiskAsset | InMemoryAsset)[] {
  let result: (OnDiskAsset | InMemoryAsset)[] = impliedAddonAssets(engine).map((sourcePath: string): OnDiskAsset => {
    let stats = statSync(sourcePath);
    return {
      kind: 'on-disk',
      relativePath: explicitRelative(root, sourcePath),
      sourcePath,
      mtime: stats.mtimeMs,
      size: stats.size,
    };
  });

  result.unshift({
    kind: 'in-memory',
    relativePath: '_testing_prefix_.js',
    source: `var runningTests=false;`,
  });

  result.unshift({
    kind: 'in-memory',
    relativePath: '_ember_env_.js',
    source: `window.EmberENV={ ...(window.EmberENV || {}), ...${JSON.stringify(emberENV, null, 2)} };`,
  });

  result.push({
    kind: 'in-memory',
    relativePath: '_loader_.js',
    source: `loader.makeDefaultExport=false;`,
  });

  return result;
}

function impliedAddonAssets({ engine }: AppFiles): string[] {
  let result: Array<string> = [];
  for (let addon of sortBy(Array.from(engine.addons.keys()) /*, scriptPriority.bind(this)*/)) {
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

// function scriptPriority(pkg: Package) {
//   switch (pkg.name) {
//     case 'loader.js':
//       return 0;
//     case 'ember-source':
//       return 10;
//     default:
//       return 1000;
//   }
// }

// TODO - the initial function updateConcatenatedAsset is async and relies on SourceMapConcat
// see commented function below
function updateImplicitScriptAssetSync(asset: ConcatenatedAsset) {
  let concat = '';
  for (let source of asset.sources) {
    switch (source.kind) {
      case 'on-disk':
        let content = readFileSync(source.sourcePath);
        concat = `${concat}${content}`;
        break;
      case 'in-memory':
        if (typeof source.source !== 'string') {
          throw new Error(`attempted to concatenated a Buffer-backed in-memory asset`);
        }
        concat = `${concat}${source.source}`;
        break;
      // default:
      //   assertNever(source);
    }
  }
  return concat;
}

// async function updateImplicitScriptAsset(asset: ConcatenatedAsset, root: string, fromFile: string) {
//   let concat = new SourceMapConcat({
//     outputFile: fromFile,
//     mapCommentType: asset.relativePath.endsWith('.js') ? 'line' : 'block',
//     baseDir: root,
//   });
//   if (process.env.EMBROIDER_CONCAT_STATS) {
//     let MeasureConcat = (await import('@embroider/core/src/measure-concat')).default;
//     concat = new MeasureConcat(asset.relativePath, concat, root);
//   }
//   for (let source of asset.sources) {
//     switch (source.kind) {
//       case 'on-disk':
//         concat.addFile(explicitRelative(root, source.sourcePath));
//         break;
//       case 'in-memory':
//         if (typeof source.source !== 'string') {
//           throw new Error(`attempted to concatenated a Buffer-backed in-memory asset`);
//         }
//         concat.addSpace(source.source);
//         break;
//       default:
//         assertNever(source);
//     }
//   }
//   await concat.end();
// }
