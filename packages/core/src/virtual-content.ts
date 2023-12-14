import { dirname, basename, resolve, posix, sep, join } from 'path';
import type { Resolver, AddonPackage, Package } from '.';
import { explicitRelative, extensionsPattern } from '.';
import { compile } from './js-handlebars';
import { BuiltEmberAsset, ConcatenatedAsset, InMemoryAsset, OnDiskAsset } from './asset';
import { existsSync, readFileSync } from 'fs';

const externalESPrefix = '/@embroider/ext-es/';
const externalCJSPrefix = '/@embroider/ext-cjs/';
const assetPrefix = '@embroider-assets:';

// Given a filename that was passed to your ModuleRequest's `virtualize()`,
// this produces the corresponding contents. It's a static, stateless function
// because we recognize that that process that did resolution might not be the
// same one that loads the content.
export function virtualContent(filename: string, resolver: Resolver): string {
  const CompatApp = require('../../compat/src/compat-app').default as typeof import('../../compat/src/compat-app').default;
  const compatAppBuilder = CompatApp.getCachedBuilderInstance(resolver.options.appRoot);
  let cjsExtern = decodeVirtualExternalCJSModule(filename);
  if (cjsExtern) {
    return renderCJSExternalShim(cjsExtern);
  }

  let extern = decodeVirtualExternalESModule(filename);
  if (extern) {
    return renderESExternalShim(extern);
  }
  let match = decodeVirtualPairComponent(filename);
  if (match) {
    return pairedComponentShim(match);
  }

  let fb = decodeFastbootSwitch(filename);
  if (fb) {
    return fastbootSwitchTemplate(fb);
  }

  let im = decodeImplicitModules(filename);
  if (im) {
    return renderImplicitModules(im, resolver);
  }

  let asset = decodeVirtualAsset(filename);
  if (asset) {
    if (asset.moduleName === '/' + join('assets', resolver.options.modulePrefix + '.js')) {
      return compatAppBuilder.rebuildEntryFile(join(resolver.options.appRoot, 'app'));
    }
    if (asset.moduleName === '/' + join('assets', 'test.js')) {
      return compatAppBuilder.rebuildEntryFile(join(resolver.options.appRoot, 'tests'));
    }
    if (asset.moduleName === join(resolver.options.appRoot, 'index.html')) {
      return compatAppBuilder.rebuildHtml(resolver.options.appRoot, resolver.options.environment!, 'app');
    }
    if (asset.moduleName === join(resolver.options.appRoot, 'tests', 'index.html')) {
      return compatAppBuilder.rebuildHtml(join(resolver.options.appRoot, 'tests'), resolver.options.environment!, 'test');
    }
    const finalAssets = compatAppBuilder.buildCachedAssets(resolver.options.environment!);
    const found = finalAssets.find(a => '/' + a.relativePath === asset!.moduleName.replace(resolver.options.appRoot, '') || a.relativePath === asset!.moduleName);
    const source = (found as (InMemoryAsset|BuiltEmberAsset)).source?.toString() || (found as ConcatenatedAsset).code!
    if (source) {
      return source;
    }
    const onDisk = (found as OnDiskAsset);
    if (onDisk.sourcePath && existsSync(onDisk.sourcePath)) {
      return readFileSync(onDisk.sourcePath).toString();
    }
  }

  throw new Error(`not an @embroider/core virtual file: ${filename}`);
}

const externalESShim = compile(`
{{#if (eq moduleName "require")}}
const m = window.requirejs;
export default m;
const has = m.has;
export { has }
{{else}}
const m = window.require("{{{js-string-escape moduleName}}}");
{{#if default}}
export default m.default;
{{/if}}
{{#if names}}
const { {{#each names as |name|}}{{name}}, {{/each}} } = m;
export { {{#each names as |name|}}{{name}}, {{/each}} }
{{/if}}
{{/if}}
`) as (params: { moduleName: string; default: boolean; names: string[] }) => string;

function renderESExternalShim({ moduleName, exports }: { moduleName: string; exports: string[] }): string {
  return externalESShim({
    moduleName,
    default: exports.includes('default'),
    names: exports.filter(n => n !== 'default'),
  });
}

const pairedComponentShim = compile(`
import { setComponentTemplate } from "@ember/component";
import template from "{{{js-string-escape relativeHBSModule}}}";
{{#if relativeJSModule}}
import component from "{{{js-string-escape relativeJSModule}}}";
export default setComponentTemplate(template, component);
{{else}}
import templateOnlyComponent from "@ember/component/template-only";
export default setComponentTemplate(template, templateOnlyComponent(undefined, "{{{js-string-escape debugName}}}"));
{{/if}}
`) as (params: { relativeHBSModule: string; relativeJSModule: string | null; debugName: string }) => string;

export function virtualExternalESModule(specifier: string, exports: string[] | undefined): string {
  if (exports) {
    return externalESPrefix + specifier + `?exports=${exports.join(',')}`;
  } else {
    return externalESPrefix + specifier;
  }
}

export function virtualExternalCJSModule(specifier: string): string {
  return externalCJSPrefix + specifier;
}

function decodeVirtualExternalESModule(filename: string): { moduleName: string; exports: string[] } | undefined {
  if (filename.startsWith(externalESPrefix)) {
    let exports: string[] = [];
    let url = new URL(filename.slice(externalESPrefix.length), 'http://example.com');
    let nameString = url.searchParams.get('exports');
    if (nameString) {
      exports = nameString.split(',');
    }
    let moduleName = url.pathname.slice(1);
    return { moduleName, exports };
  }
}

function decodeVirtualExternalCJSModule(filename: string) {
  if (filename.startsWith(externalCJSPrefix)) {
    return { moduleName: filename.slice(externalCJSPrefix.length) };
  }
}

export function decodeVirtualAsset(filename: string) {
  if (filename.startsWith(assetPrefix)) {
    return { moduleName: filename.slice(assetPrefix.length).split('?')[0] };
  }
}

const pairComponentMarker = '/embroider-pair-component';
const pairComponentPattern = /^(?<hbsModule>.*)\/(?<jsModule>[^\/]*)\/embroider-pair-component$/;

export function virtualPairComponent(hbsModule: string, jsModule: string | null): string {
  let relativeJSModule = '';
  if (jsModule) {
    // The '/j/' here represents the relativeJSModule itself that we're about to
    // use to create the complete filename. It's there to get the right number
    // of `..` in our relative path.
    relativeJSModule = explicitRelative(hbsModule + '/j/', jsModule);
  }
  return `${hbsModule}/${encodeURIComponent(relativeJSModule)}${pairComponentMarker}`;
}

function decodeVirtualPairComponent(
  filename: string
): { relativeHBSModule: string; relativeJSModule: string | null; debugName: string } | null {
  // Performance: avoid paying regex exec cost unless needed
  if (!filename.includes(pairComponentMarker)) {
    return null;
  }
  let match = pairComponentPattern.exec(filename);
  if (!match) {
    return null;
  }
  let { hbsModule, jsModule } = match.groups! as { hbsModule: string; jsModule: string };
  // target our real hbs module from our virtual module
  let relativeHBSModule = explicitRelative(dirname(filename), hbsModule);
  return {
    relativeHBSModule,
    relativeJSModule: decodeURIComponent(jsModule) || null,
    debugName: basename(relativeHBSModule).replace(/\.(js|hbs)$/, ''),
  };
}

const fastbootSwitchSuffix = '/embroider_fastboot_switch';
const fastbootSwitchPattern = /(?<original>.+)\/embroider_fastboot_switch(?:\?names=(?<names>.+))?$/;
export function fastbootSwitch(specifier: string, fromFile: string, names: Set<string>): string {
  let filename = `${resolve(dirname(fromFile), specifier)}${fastbootSwitchSuffix}`;
  if (names.size > 0) {
    return `${filename}?names=${[...names].join(',')}`;
  } else {
    return filename;
  }
}

export function decodeFastbootSwitch(filename: string) {
  // Performance: avoid paying regex exec cost unless needed
  if (!filename.includes(fastbootSwitchSuffix)) {
    return;
  }
  let match = fastbootSwitchPattern.exec(filename);
  if (match) {
    let names = match.groups?.names?.split(',') ?? [];
    return {
      names: names.filter(name => name !== 'default'),
      hasDefaultExport: names.includes('default'),
      filename: match.groups!.original,
    };
  }
}

const fastbootSwitchTemplate = compile(`
import { macroCondition, getGlobalConfig, importSync } from '@embroider/macros';
let mod;
if (macroCondition(getGlobalConfig().fastboot?.isRunning)){
  mod = importSync('./fastboot');
} else {
  mod = importSync('./browser');
}
{{#if hasDefaultExport}}
export default mod.default;
{{/if}}
{{#each names as |name|}}
export const {{name}} = mod.{{name}};
{{/each}}
`) as (params: { names: string[]; hasDefaultExport: boolean }) => string;

const implicitModulesPattern = /(?<filename>.*)[\\/]-embroider-implicit-(?<test>test-)?modules\.js$/;

export function decodeImplicitModules(
  filename: string
): { type: 'implicit-modules' | 'implicit-test-modules'; fromFile: string } | undefined {
  // Performance: avoid paying regex exec cost unless needed
  if (!filename.includes('-embroider-implicit-')) {
    return;
  }
  let m = implicitModulesPattern.exec(filename);
  if (m) {
    return {
      type: m.groups!.test ? 'implicit-test-modules' : 'implicit-modules',
      fromFile: m.groups!.filename,
    };
  }
}

function renderImplicitModules(
  {
    type,
    fromFile,
  }: {
    type: 'implicit-modules' | 'implicit-test-modules';
    fromFile: string;
  },
  resolver: Resolver
): string {
  let resolvableExtensionsPattern = extensionsPattern(resolver.options.resolvableExtensions);

  const pkg = resolver.packageCache.ownerOfFile(fromFile);
  if (!pkg?.isV2Ember()) {
    throw new Error(`bug: saw special implicit modules import in non-ember package at ${fromFile}`);
  }

  let lazyModules: { runtime: string; buildtime: string }[] = [];
  let eagerModules: string[] = [];

  let deps = pkg.dependencies.sort(orderAddons);

  for (let dep of deps) {
    // anything that isn't a v2 ember package by this point is not an active
    // addon.
    if (!dep.isV2Addon()) {
      continue;
    }

    // we ignore peerDependencies here because classic ember-cli ignores
    // peerDependencies here, and we're implementing the implicit-modules
    // backward-comptibility feature.
    if (pkg.categorizeDependency(dep.name) === 'peerDependencies') {
      continue;
    }

    let implicitModules = dep.meta[type];
    if (implicitModules) {
      let renamedModules = inverseRenamedModules(dep.meta, resolvableExtensionsPattern);
      for (let name of implicitModules) {
        let packageName = dep.name;

        let renamedMeta = dep.meta['renamed-packages'];
        if (renamedMeta) {
          Object.entries(renamedMeta).forEach(([key, value]) => {
            if (value === dep.name) {
              packageName = key;
            }
          });
        }

        let runtime = join(packageName, name).replace(resolvableExtensionsPattern, '');
        let runtimeRenameLookup = runtime.split('\\').join('/');
        if (renamedModules && renamedModules[runtimeRenameLookup]) {
          runtime = renamedModules[runtimeRenameLookup];
        }
        runtime = runtime.split(sep).join('/');
        lazyModules.push({
          runtime,
          buildtime: posix.join(packageName, name),
        });
      }
    }
    // we don't recurse across an engine boundary. Engines import their own
    // implicit-modules.
    if (!dep.isEngine()) {
      eagerModules.push(posix.join(dep.name, `-embroider-${type}.js`));
    }
  }
  return implicitModulesTemplate({ lazyModules, eagerModules });
}

const implicitModulesTemplate = compile(`
import { importSync as i } from '@embroider/macros';
let d = window.define;
{{#each lazyModules as |module|}}
d("{{js-string-escape module.runtime}}", function(){ return i("{{js-string-escape module.buildtime}}");});
{{/each}}
{{#each eagerModules as |module|}}
import "{{js-string-escape module}}";
{{/each}}
`) as (params: { eagerModules: string[]; lazyModules: { runtime: string; buildtime: string }[] }) => string;

// meta['renamed-modules'] has mapping from classic filename to real filename.
// This takes that and converts it to the inverst mapping from real import path
// to classic import path.
function inverseRenamedModules(meta: AddonPackage['meta'], extensions: RegExp) {
  let renamed = meta['renamed-modules'];
  if (renamed) {
    let inverted = {} as { [name: string]: string };
    for (let [classic, real] of Object.entries(renamed)) {
      inverted[real.replace(extensions, '')] = classic.replace(extensions, '');
    }
    return inverted;
  }
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

const renderCJSExternalShim = compile(`
{{#if (eq moduleName "require")}}
const m = window.requirejs;
{{else}}
const m = window.require("{{{js-string-escape moduleName}}}");
{{/if}}
{{!-
  There are plenty of hand-written AMD defines floating around
  that lack this, and they will break when other build systems
  encounter them.

  As far as I can tell, Ember's loader was already treating this
  case as a module, so in theory we aren't breaking anything by
  marking it as such when other packagers come looking.

  todo: get review on this part.
-}}
if (m.default && !m.__esModule) {
  m.__esModule = true;
}
module.exports = m;
`) as (params: { moduleName: string }) => string;
