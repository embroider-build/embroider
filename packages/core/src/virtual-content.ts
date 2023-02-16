import { dirname } from 'path';
import { explicitRelative } from '.';
import { compile } from './js-handlebars';

const externalPrefix = '/@embroider/external/';

// Given a filename that was passed to your ModuleRequest's `virtualize()`,
// this produces the corresponding contents. It's a static, stateless function
// because we recognize that that process that did resolution might not be the
// same one that loads the content.
export function virtualContent(filename: string): string {
  if (filename.startsWith(externalPrefix)) {
    return externalShim({ moduleName: filename.slice(externalPrefix.length) });
  }
  let match = decodeVirtualPairComponent(filename);
  if (match) {
    return pairedComponentShim(match);
  }
  throw new Error(`not an @embroider/core virtual file: ${filename}`);
}

const externalShim = compile(`
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

const pairedComponentShim = compile(`
import { setComponentTemplate } from "@ember/component";
import template from "{{{js-string-escape relativeHBSModule}}}";
{{#if relativeJSModule}}
import component from "{{{js-string-escape relativeJSModule}}}";
export default setComponentTemplate(template, component);
{{else}}
import templateOnlyComponent from "@ember/component/template-only";
debugger;
export default setComponentTemplate(template, templateOnlyComponent());
{{/if}}
`) as (params: { relativeHBSModule: string; relativeJSModule: string | null }) => string;

export function virtualExternalModule(specifier: string): string {
  return externalPrefix + specifier;
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
): { relativeHBSModule: string; relativeJSModule: string | null } | null {
  let match = pairComponentPattern.exec(filename);
  if (!match) {
    return null;
  }
  let { hbsModule, jsModule } = match.groups! as { hbsModule: string; jsModule: string };
  // target our real hbs module from our virtual module
  let relativeHBSModule = explicitRelative(dirname(filename), hbsModule);
  return { relativeHBSModule, relativeJSModule: decodeURIComponent(jsModule) || null };
}
