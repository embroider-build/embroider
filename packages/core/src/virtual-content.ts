import { basename, dirname, join, posix, resolve, sep } from 'path';
import type { AddonPackage, Package, Resolver } from '.';
import { explicitRelative, extensionsPattern } from '.';
import { compile } from './js-handlebars';
import { decodeImplicitTestScripts, renderImplicitTestScripts } from './virtual-test-support';
import { decodeTestSupportStyles, renderTestSupportStyles } from './virtual-test-support-styles';
import { decodeVirtualVendor, renderVendor } from './virtual-vendor';
import { decodeVirtualVendorStyles, renderVendorStyles } from './virtual-vendor-styles';

import { decodeEntrypoint, renderEntrypoint } from './virtual-entrypoint';
import { decodeRouteEntrypoint, renderRouteEntrypoint } from './virtual-route-entrypoint';
import { readFileSync } from 'fs-extra';

const externalESPrefix = '/@embroider/ext-es/';
const externalCJSPrefix = '/@embroider/ext-cjs/';

export interface VirtualContentResult {
  src: string;
  watches: string[];
}

// Given a filename that was passed to your ModuleRequest's `virtualize()`,
// this produces the corresponding contents. It's a static, stateless function
// because we recognize that that process that did resolution might not be the
// same one that loads the content.
export function virtualContent(filename: string, resolver: Resolver): VirtualContentResult {
  let cjsExtern = decodeVirtualExternalCJSModule(filename);
  if (cjsExtern) {
    return renderCJSExternalShim(cjsExtern);
  }

  let entrypoint = decodeEntrypoint(filename);
  if (entrypoint) {
    return renderEntrypoint(resolver, entrypoint);
  }

  let routeEntrypoint = decodeRouteEntrypoint(filename);
  if (routeEntrypoint) {
    return renderRouteEntrypoint(resolver, routeEntrypoint);
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
    return renderFastbootSwitchTemplate(fb);
  }

  let appjs = decodeAppJsMatch(filename);
  if (appjs) {
    return renderAppJs(appjs.filename);
  }

  let im = decodeImplicitModules(filename);
  if (im) {
    return renderImplicitModules(im, resolver);
  }

  let isVendor = decodeVirtualVendor(filename);
  if (isVendor) {
    return renderVendor(filename, resolver);
  }

  let isImplicitTestScripts = decodeImplicitTestScripts(filename);
  if (isImplicitTestScripts) {
    return renderImplicitTestScripts(filename, resolver);
  }

  let isVendorStyles = decodeVirtualVendorStyles(filename);
  if (isVendorStyles) {
    return renderVendorStyles(filename, resolver);
  }

  let isTestSupportStyles = decodeTestSupportStyles(filename);
  if (isTestSupportStyles) {
    return renderTestSupportStyles(filename, resolver);
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

function renderESExternalShim({
  moduleName,
  exports,
}: {
  moduleName: string;
  exports: string[];
}): VirtualContentResult {
  return {
    src: externalESShim({
      moduleName,
      default: exports.includes('default'),
      names: exports.filter(n => n !== 'default'),
    }),
    watches: [],
  };
}

interface PairedComponentShimParams {
  relativeHBSModule: string;
  relativeJSModule: string | null;
  debugName: string;
}

function pairedComponentShim(params: PairedComponentShimParams): VirtualContentResult {
  return {
    src: pairedComponentShimTemplate(params),
    watches: [],
  };
}

const pairedComponentShimTemplate = compile(`
import { setComponentTemplate } from "@ember/component";
import template from "{{{js-string-escape relativeHBSModule}}}";
{{#if relativeJSModule}}
import component from "{{{js-string-escape relativeJSModule}}}";
export default setComponentTemplate(template, component);
{{else}}
import templateOnlyComponent from "@ember/component/template-only";
export default setComponentTemplate(template, templateOnlyComponent(undefined, "{{{js-string-escape debugName}}}"));
{{/if}}
`) as (params: PairedComponentShimParams) => string;

export function virtualExternalESModule(specifier: string, exports: string[] | undefined): string {
  if (exports) {
    return externalESPrefix + specifier + `/exports=${exports.join(',')}`;
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
    let components = filename.split('/exports=');
    let nameString = components[1];
    if (nameString) {
      exports = nameString.split(',');
    }
    let moduleName = components[0].slice(externalESPrefix.length);
    return { moduleName, exports };
  }
}

function decodeVirtualExternalCJSModule(filename: string) {
  if (filename.startsWith(externalCJSPrefix)) {
    return { moduleName: filename.slice(externalCJSPrefix.length) };
  }
}

const pairComponentMarker = '-embroider-pair-component';
const pairComponentPattern = /^(?<hbsModule>.*)__vpc__(?<jsModule>[^\/]*)-embroider-pair-component$/;

export function virtualPairComponent(hbsModule: string, jsModule: string | undefined): string {
  let relativeJSModule = '';
  if (jsModule) {
    relativeJSModule = explicitRelative(dirname(hbsModule), jsModule);
  }
  return `${hbsModule}__vpc__${encodeURIComponent(relativeJSModule)}${pairComponentMarker}`;
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

const appJsMatchPrefix = '/embroider_appjs_match/';
const appJsMatchPattern = /\/embroider_appjs_match\/(?<original>.+)$/;
export function encodeAppJsMatch(specifier: string, fromFile: string): string {
  return `${appJsMatchPrefix}${fromFile}::${specifier}`;
}

export function decodeAppJsMatch(filename: string) {
  // Performance: avoid paying regex exec cost unless needed
  if (!filename.includes(appJsMatchPrefix)) {
    return;
  }
  let match = appJsMatchPattern.exec(filename);
  if (match) {
    let [from, to] = match.groups!.original.split('::');
    console.log('from', from, to);
    return {
      filename: require.resolve(to, {
        paths: [resolve(dirname(from), 'node_modules')],
      }),
    };
  }
}

function renderAppJs(filename: string) {
  return {
    src: readFileSync(filename).toString(),
    watches: [filename],
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

interface FastbootSwitchParams {
  names: string[];
  hasDefaultExport: boolean;
}

function renderFastbootSwitchTemplate(params: FastbootSwitchParams): VirtualContentResult {
  return {
    src: fastbootSwitchTemplate(params),
    watches: [],
  };
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
`) as (params: FastbootSwitchParams) => string;

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
): VirtualContentResult {
  let resolvableExtensionsPattern = extensionsPattern(resolver.options.resolvableExtensions);

  const pkg = resolver.packageCache.ownerOfFile(fromFile);
  if (!pkg?.isV2Ember()) {
    throw new Error(`bug: saw special implicit modules import in non-ember package at ${fromFile}`);
  }

  let ownModules: { runtime: string; buildtime: string }[] = [];
  let dependencyModules: string[] = [];

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
        ownModules.push({
          runtime,
          buildtime: posix.join(packageName, name),
        });
      }
    }
    // we don't recurse across an engine boundary. Engines import their own
    // implicit-modules.
    if (!dep.isEngine()) {
      dependencyModules.push(posix.join(dep.name, `-embroider-${type}.js`));
    }
  }
  return { src: implicitModulesTemplate({ ownModules, dependencyModules }), watches: [] };
}

const implicitModulesTemplate = compile(`


{{#each dependencyModules as |module index|}}
  import dep{{index}} from "{{js-string-escape module}}";
{{/each}}

{{#each ownModules as |module index|}}
  import * as own{{index}} from "{{js-string-escape module.buildtime}}";
{{/each}}

export default Object.assign({},
  {{#each dependencyModules as |module index|}}
    dep{{index}},
  {{/each}}
  {
    {{#each ownModules as |module index|}}
      "{{js-string-escape module.runtime}}": own{{index}},
    {{/each}}
  }
);
`) as (params: { dependencyModules: string[]; ownModules: { runtime: string; buildtime: string }[] }) => string;

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

function renderCJSExternalShim(params: { moduleName: string }): VirtualContentResult {
  return {
    src: renderCJSExternalShimTemplate(params),
    watches: [],
  };
}

const renderCJSExternalShimTemplate = compile(`
module.exports = new Proxy({}, {
  get(target, prop) {

    {{!- our proxy always presents as ES module so that we can intercept "get('default')" -}}
    if (prop === '__esModule') {
      return true;
    }

    {{#if (eq moduleName "require")}}
      const m = window.requirejs;
    {{else}}
      const m = window.require("{{{js-string-escape moduleName}}}");
    {{/if}}

    {{!-
      There are plenty of hand-written AMD defines floating around
      that lack an __esModule declaration.

      As far as I can tell, Ember's loader was already treating the Boolean(m.default)===true
      case as a module, so in theory we aren't breaking anything by
      treating it as such when other packagers come looking.
    -}}
    if (prop === 'default' && !m.__esModule && !m.default) {
      return m;
    }

    return m[prop];
  }
});
`) as (params: { moduleName: string }) => string;
