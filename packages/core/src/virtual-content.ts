import { dirname, basename, resolve } from 'path';
import { explicitRelative } from '.';
import { compile } from './js-handlebars';

const externalPrefix = '/@embroider/external/';

// Given a filename that was passed to your ModuleRequest's `virtualize()`,
// this produces the corresponding contents. It's a static, stateless function
// because we recognize that that process that did resolution might not be the
// same one that loads the content.
export function virtualContent(filename: string): string {
  let extern = decodeVirtualExternalModule(filename);
  if (extern) {
    return renderExternalShim(extern);
  }
  let match = decodeVirtualPairComponent(filename);
  if (match) {
    return pairedComponentShim(match);
  }

  let fb = decodeFastbootSwitch(filename);
  if (fb) {
    return fastbootSwitchTemplate(fb);
  }

  throw new Error(`not an @embroider/core virtual file: ${filename}`);
}

const externalShim = compile(`
{{#if (eq moduleName "require")}}
const m = window.requirejs;
export default m.default;
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

function renderExternalShim(params: { moduleName: string; exports: string[] }): string {
  return externalShim({
    moduleName: params.moduleName,
    default: params.exports.includes('default'),
    names: params.exports.filter(n => n !== 'default'),
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

export function virtualExternalModule(specifier: string, exports: string[]): string {
  return externalPrefix + specifier + `?exports=${exports.join(',')}`;
}

function decodeVirtualExternalModule(filename: string) {
  if (filename.startsWith(externalPrefix)) {
    let exports: string[] = [];
    let url = new URL(filename.slice(externalPrefix.length), 'http://example.com');
    let nameString = url.searchParams.get('exports');
    if (nameString) {
      exports = nameString.split(',');
    }
    let moduleName = url.pathname.slice(1);
    return { moduleName, exports };
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
