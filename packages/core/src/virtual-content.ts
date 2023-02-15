import { compile } from './js-handlebars';

const externalPrefix = '/@embroider/external/';
const amdComponentShimMarker = '?embroider-amd-component';

// NEXT Action: can we get our general virtual file support to look like it's in
// a place in the filesystem? Possibly our resolver can notice when requests are
// coming from one of our virtual modules and rehome them.
const amdComponentShimPattern = /(?<payload>[^\/]+)\?embroider-amd-component$/;

// Given a filename that was passed to your ModuleRequest's `virtualize()`,
// this produces the corresponding contents. It's a static, stateless function
// because we recognize that that process that did resolution might not be the
// same one that loads the content.
export function virtualContent(filename: string): string {
  if (filename.startsWith(externalPrefix)) {
    return externalShim({ moduleName: filename.slice(externalPrefix.length) });
  }
  let match = amdComponentShimPattern.exec(filename);
  if (match) {
    let [hbsSpecifier, hbsRuntime, jsSpecifier, jsRuntime] = JSON.parse(decodeURIComponent(match.groups!.payload)) as [
      string,
      string,
      string | undefined,
      string | undefined
    ];
    return amdComponentShim({ hbsSpecifier, hbsRuntime, jsSpecifier, jsRuntime });
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

const amdComponentShim = compile(`
import template from "{{{js-string-escape hbsSpecifier}}}";
window.define("{{{js-string-escape hbsRuntime}}}", () => template);
{{#if jsSpecifier}}
import component from "{{{js-string-escape jsSpecifier}}}";
window.define("{{{js-string-escape jsRuntime}}}", () => template);
{{/if}}
export default todoLoadCurriedComponent();
`) as (params: {
  hbsSpecifier: string;
  hbsRuntime: string;
  jsSpecifier: string | undefined;
  jsRuntime: string | undefined;
}) => string;

export function virtualExternalModule(specifier: string): string {
  return externalPrefix + specifier;
}

export function virtualAMDComponent(
  fromFile: string,
  hbsModule: { specifier: string; runtime: string },
  jsModule: { specifier: string; runtime: string } | null
): string {
  let payload = [hbsModule.specifier, hbsModule.runtime];
  if (jsModule) {
    payload.push(jsModule.specifier);
    payload.push(jsModule.runtime);
  }
  return `${fromFile}/${encodeURIComponent(JSON.stringify(payload))}${amdComponentShimMarker}`;
}
