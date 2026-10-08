import type { Plugin } from 'vite';
import type { Preprocessor } from 'content-tag';
import { init as initLexer, parse as parseModule } from 'es-module-lexer';
import { sep } from 'path';

/*
  Hot Module Replacement for .gjs/.gts components.

  The strategy, per module:

  1. Every <template> gets wrapped in a {{#let}} that re-binds the module's
     locally-imported names to their *current* hot version:

       {{#let (__ehr_current Foo) as |Foo|}} ...original template... {{/let}}

     `__ehr_current` is a plain function helper that reads a tracked cell, so
     when Foo's module is hot-replaced, only the parts of the template that
     render <Foo> re-render. Everything else (including this component's own
     state) is kept.

  2. The module's default export is registered with the runtime under the
     module's file path, and the module self-accepts. When the file changes,
     Vite re-evaluates just that module, which re-registers under the same id
     and so updates the tracked cell that every `__ehr_current` reads.

  3. Route templates (anything under a `templates/` directory) are rendered by
     the router, not by another template, so there is no invocation site to
     re-bind. For those, the default export becomes a stable facade that
     renders the current version and forwards the two args routes pass
     (@model and @controller).

  When a module can't be swapped safely (it has named exports, or nothing ever
  rendered it through the runtime) we fall back to Vite's normal behavior,
  which ends in a full page reload.
*/

export const hmrRuntimeId = 'virtual:embroider-hmr-runtime';
const resolvedRuntimeId = '\0' + hmrRuntimeId;

// Runs in the browser. It has no imports so that it doesn't need to go
// through Embroider's resolver; modules hand it `tracked` instead.
const runtimeSource = `
const entries = new Map();
const byValue = new WeakMap();

function isRef(value) {
  return value !== null && (typeof value === 'object' || typeof value === 'function');
}

function makeEntry(tracked, value) {
  class Entry {}
  let desc = tracked(Entry.prototype, 'current', { configurable: true, enumerable: true, writable: true, initializer: null });
  Object.defineProperty(Entry.prototype, 'current', desc);
  let entry = new Entry();
  entry.current = value;
  entry.consumed = false;
  return entry;
}

export function define(id, value, tracked) {
  let entry = entries.get(id);
  if (entry) {
    entry.current = value;
  } else {
    entry = makeEntry(tracked, value);
    entries.set(id, entry);
  }
  if (isRef(value)) {
    byValue.set(value, entry);
  }
}

export function current(value) {
  let entry = isRef(value) ? byValue.get(value) : undefined;
  if (!entry) {
    return value;
  }
  entry.consumed = true;
  return entry.current;
}

export function consumed(id) {
  return Boolean(entries.get(id)?.consumed);
}
`;

export function hmrRuntime(): Plugin {
  return {
    name: 'embroider-hmr-runtime',
    enforce: 'pre',
    apply: 'serve',
    resolveId(source) {
      if (source === hmrRuntimeId) {
        return resolvedRuntimeId;
      }
    },
    load(id) {
      if (id === resolvedRuntimeId) {
        return runtimeSource;
      }
    },
  };
}

export function shouldHotTransform(id: string, root: string): boolean {
  let file = cleanId(id);
  return file.startsWith(root) && !file.includes(`${sep}node_modules${sep}`) && !file.includes('/node_modules/');
}

const DEFAULT_LOCAL = '__embroider_hmr_default__';
const FACADE_LOCAL = '__embroider_hmr_route_facade__';

// Takes raw .gjs/.gts source and returns the JS that content-tag would have
// produced, plus the HMR wiring described at the top of this file.
export async function hotTransform(
  preprocessor: Preprocessor,
  code: string,
  id: string
): Promise<{ code: string; map?: string }> {
  await initLexer;
  let file = cleanId(id);

  // First pass: plain content-tag output, so we can analyze imports and
  // exports with a normal JS lexer.
  let plain = preprocessor.process(code, { filename: id }).code;
  let [imports, exports] = parseModule(plain);

  let exportNames = exports.map(e => e.n);
  let canSelfAccept = exportNames.length === 1 && exportNames[0] === 'default';
  let defaultExport = exports.find(e => e.n === 'default');
  let isRouteTemplate = /[\\/]templates[\\/]/.test(file);

  let locals = new Set<string>();
  for (let imp of imports) {
    if (imp.d !== -1 || !imp.n || !isLocalSpecifier(imp.n)) {
      continue;
    }
    for (let local of importedLocals(plain.slice(imp.ss, imp.se))) {
      locals.add(local);
    }
  }

  // Wrap each template so its imported names resolve to the current hot
  // version. Edits are applied back to front so earlier offsets stay valid.
  let templates = preprocessor.parse(code, { filename: id });
  let edited = code;
  for (let tpl of [...templates].reverse()) {
    let start = tpl.contentRange.startUtf16Codepoint;
    let end = tpl.contentRange.endUtf16Codepoint;
    let contents = edited.slice(start, end);
    let used = [...locals].filter(name => new RegExp(`(?<![\\w$.@])${escapeRE(name)}(?![\\w$])`).test(contents));
    if (used.length === 0) {
      continue;
    }
    let open = `{{#let ${used.map(n => `(__ehr_current ${n})`).join(' ')} as |${used.join(' ')}|}}`;
    edited = edited.slice(0, start) + open + contents + '{{/let}}' + edited.slice(end);
  }

  let defaultRef: string | undefined;
  let keywordDefault = false;
  if (defaultExport) {
    keywordDefault = /export\s+$/.test(plain.slice(0, defaultExport.s));
    defaultRef = localName(defaultExport.ln) ?? (keywordDefault ? DEFAULT_LOCAL : undefined);
  }

  // Route templates can only be swapped if we're able to replace the default
  // export with the facade.
  let useFacade = isRouteTemplate && canSelfAccept && keywordDefault && defaultRef;
  if (isRouteTemplate && !useFacade) {
    canSelfAccept = false;
  }
  if (useFacade) {
    edited += `\nconst ${FACADE_LOCAL} = <template>{{#let (__ehr_current ${defaultRef}) as |C|}}<C @model={{@model}} @controller={{@controller}} />{{/let}}</template>;\n`;
  }

  // Keep this on the first line so line numbers don't move.
  let header =
    `import { current as __ehr_current, define as __ehr_define, consumed as __ehr_consumed } from ${JSON.stringify(
      hmrRuntimeId
    )}; ` + `import { tracked as __ehr_tracked } from '@glimmer/tracking'; `;

  let result = preprocessor.process(header + edited, { filename: id });
  let out = result.code;

  if (!defaultRef) {
    return { code: out, map: result.map };
  }

  // Take over the default export so we can register (and, for routes,
  // replace) the value.
  let rewrote = false;
  if (keywordDefault) {
    let [, finalExports] = parseModule(out);
    let finalDefault = finalExports.find(e => e.n === 'default');
    if (finalDefault) {
      let exportStart = out.lastIndexOf('export', finalDefault.s);
      out =
        out.slice(0, exportStart) +
        (localName(finalDefault.ln) ? '' : `const ${DEFAULT_LOCAL} =`) +
        out.slice(finalDefault.e);
      rewrote = true;
    }
  }
  if (keywordDefault && !rewrote) {
    // couldn't find it again, leave the module alone
    return { code: preprocessor.process(code, { filename: id }).code };
  }

  let footer = [`\n__ehr_define(${JSON.stringify(file)}, ${defaultRef}, __ehr_tracked);`];
  if (rewrote) {
    footer.push(`export default ${useFacade ? FACADE_LOCAL : defaultRef};`);
  }
  if (canSelfAccept) {
    footer.push(
      `if (import.meta.hot) {`,
      `  import.meta.hot.accept(() => {`,
      `    if (!__ehr_consumed(${JSON.stringify(file)})) {`,
      `      import.meta.hot.invalidate('nothing rendered this module through the HMR runtime');`,
      `    }`,
      `  });`,
      `}`
    );
  }
  return { code: out + footer.join('\n') + '\n', map: result.map };
}

// es-module-lexer reports `export default class extends Foo {}` as having the
// local name "extends".
function localName(ln: string | undefined): string | undefined {
  return ln && ln !== 'extends' ? ln : undefined;
}

function cleanId(id: string): string {
  return id.replace(/[?#].*$/, '');
}

function isLocalSpecifier(specifier: string): boolean {
  return specifier.startsWith('.') || specifier.startsWith('#') || specifier.startsWith('/');
}

function escapeRE(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Given the text of one static import declaration, returns the local names it
// binds (skipping type-only imports).
export function importedLocals(statement: string): string[] {
  let match = /^import\s+([\s\S]*?)\s*from\s*['"]/.exec(statement);
  if (!match) {
    return [];
  }
  let clause = match[1].trim();
  if (/^type\s/.test(clause)) {
    return [];
  }
  let names: string[] = [];
  let braces = /\{([\s\S]*)\}/.exec(clause);
  if (braces) {
    for (let part of braces[1].split(',')) {
      part = part.trim();
      if (!part || /^type\s/.test(part)) continue;
      let alias = /\sas\s+([\w$]+)$/.exec(part);
      names.push(alias ? alias[1] : part);
    }
    clause = clause.replace(braces[0], '');
  }
  for (let part of clause.split(',')) {
    part = part.trim();
    if (!part) continue;
    let ns = /^\*\s*as\s+([\w$]+)$/.exec(part);
    names.push(ns ? ns[1] : part);
  }
  return names.filter(n => /^[\w$]+$/.test(n));
}
