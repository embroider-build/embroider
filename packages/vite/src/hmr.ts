import type { Plugin } from 'vite';
import type { Preprocessor } from 'content-tag';
import { init as initLexer, parse as parseModule } from 'es-module-lexer';
import { sep } from 'path';

/**
 * Hot Module Replacement for .gjs/.gts components.
 *
 * Glimmer reads a template's scope values once, when it compiles the template,
 * so an imported component can't be swapped by changing the binding behind it.
 * A wrapper component doesn't work either.
 * There is no way to forward arbitrary args and blocks to an inner component.
 *
 * So each template re-binds its imports through a helper that reads a tracked value:
 *
 *    {{#let (__ehr_current Foo) as |Foo|}} ...original template... {{/let}}
 *
 * Glimmer already re-renders a dynamic component when its value changes.
 * The {{#let}} also leaves scoping rules, like block params and shadowing, to Glimmer.
 * Only the parts that render <Foo> are torn down,
 * so the rest of the page keeps its state.
 *
 * Each component module accepts its own updates instead of relying on its importers.
 * That way the swap happens in one place no matter how many modules import it,
 * and the module's new version just re-registers under its file path.
 *
 * Route templates are the exception: the router renders them,
 * so there is no template to re-bind in.
 * Routes pass a fixed set of args (@model and @controller),
 * which makes a forwarding wrapper possible there.
 *
 * Anything we can't swap safely falls back to Vite's normal update path,
 * because a full reload is always better than a page that silently shows stale code.
 */
export const hmrRuntimeId = 'virtual:embroider-hmr-runtime';
const resolvedRuntimeId = '\0' + hmrRuntimeId;

/**
 * This runs in the browser.
 * It has no imports on purpose: a virtual module has no location on disk,
 * so Embroider's resolver has nothing to resolve `@glimmer/tracking` against.
 * The app modules that call `define` can import it normally,
 * so they pass `tracked` in.
 *
 * `byValue` exists because importers keep whichever version they imported first,
 * and Vite never updates their bindings.
 * Mapping every version to one entry lets an old value find the newest one.
 *
 * `consumed` lets a swap that nobody will see fall back to a reload.
 * Otherwise it would look like HMR did nothing.
 *
 * `tracked` is called as a function, not used as a decorator.
 * That way the runtime doesn't depend on the app's babel config supporting decorators.
 */
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

/**
 * The `\0` prefix is the Rollup convention for virtual modules,
 * which tells other plugins to leave the id alone.
 * `enforce: 'pre'` makes this run before Embroider's resolver,
 * which would otherwise try to resolve the id as a package and fail.
 */
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

/**
 * Code from node_modules and outside the app root is usually prebuilt.
 * People don't edit it, so wrapping it only adds risk.
 */
export function shouldHotTransform(id: string, root: string): boolean {
  let file = cleanId(id);
  return file.startsWith(root) && !file.includes(`${sep}node_modules${sep}`) && !file.includes('/node_modules/');
}

/**
 * These names end up in user modules,
 * so they are long enough that they won't collide with anything the user wrote.
 */
const DEFAULT_LOCAL = '__embroider_hmr_default__';
const FACADE_LOCAL = '__embroider_hmr_route_facade__';

/**
 * Takes raw .gjs/.gts source and returns what content-tag would produce,
 * plus the HMR wiring described at the top of this file.
 */
export async function hotTransform(
  preprocessor: Preprocessor,
  code: string,
  id: string
): Promise<{ code: string; map?: string }> {
  await initLexer;
  let file = cleanId(id);

  /**
   * Raw .gjs isn't valid JS, so a JS lexer can't read it.
   * Running content-tag once just for analysis is cheap.
   * It saves us from writing a gjs parser.
   */
  let plain = preprocessor.process(code, { filename: id }).code;
  let [imports, exports] = parseModule(plain);

  /**
   * Self-accepting a module with named exports would leave plain JS importers
   * holding stale values, with nothing to tell them.
   * Those modules let the update propagate to their importers instead.
   */
  let exportNames = exports.map(e => e.n);
  let canSelfAccept = exportNames.length === 1 && exportNames[0] === 'default';
  let defaultExport = exports.find(e => e.n === 'default');
  let isRouteTemplate = /[\\/]templates[\\/]/.test(file);

  /**
   * Only app-local imports can change during a dev session.
   * Leaving package imports alone keeps things like `on` out of the {{#let}}.
   * They would gain nothing there and could behave differently.
   */
  let locals = new Set<string>();
  for (let imp of imports) {
    if (imp.d !== -1 || !imp.n || !isLocalSpecifier(imp.n)) {
      continue;
    }
    for (let local of importedLocals(plain.slice(imp.ss, imp.se))) {
      locals.add(local);
    }
  }

  /**
   * Edits go back to front so the offsets content-tag gave us stay valid.
   *
   * A name is only re-bound if the template mentions it.
   * Putting a name into the template's scope keeps that import alive at runtime.
   * In .gts, a value import used only as a type gets removed by TypeScript,
   * so binding it would point at something that doesn't exist.
   */
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

  /**
   * A route template that can't get the wrapper must not self-accept.
   * The router would keep rendering the version it already has,
   * and the edit would never show up.
   */
  let useFacade = isRouteTemplate && canSelfAccept && keywordDefault && defaultRef;
  if (isRouteTemplate && !useFacade) {
    canSelfAccept = false;
  }
  if (useFacade) {
    edited += `\nconst ${FACADE_LOCAL} = <template>{{#let (__ehr_current ${defaultRef}) as |C|}}<C @model={{@model}} @controller={{@controller}} />{{/let}}</template>;\n`;
  }

  /**
   * content-tag's source map is relative to the text we hand it.
   * So the header shares the user's first line,
   * because a new line here would shift every mapped line by one.
   */
  let header =
    `import { current as __ehr_current, define as __ehr_define, consumed as __ehr_consumed } from ${JSON.stringify(
      hmrRuntimeId
    )}; ` + `import { tracked as __ehr_tracked } from '@glimmer/tracking'; `;

  let result = preprocessor.process(header + edited, { filename: id });
  let out = result.code;

  if (!defaultRef) {
    return { code: out, map: result.map };
  }

  /**
   * An anonymous default export has no local name,
   * and we need one to register the value and, for routes,
   * to export the wrapper in its place.
   * A named class keeps its declaration.
   * Other code in the module may refer to it by name.
   */
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
    /**
     * Half-applied wiring is worse than none,
     * so the module gets plain content-tag output.
     */
    return { code: preprocessor.process(code, { filename: id }).code };
  }

  let footer = [`\n__ehr_define(${JSON.stringify(file)}, ${defaultRef}, __ehr_tracked);`];
  if (rewrote) {
    footer.push(`export default ${useFacade ? FACADE_LOCAL : defaultRef};`);
  }
  /**
   * Some modules never render through `__ehr_current`.
   * They might only be used from JS, or through a string lookup.
   * For those the swap can't reach the screen.
   * `invalidate` hands the update to the importers.
   */
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

/**
 * es-module-lexer reports `export default class extends Foo {}`
 * as having the local name "extends".
 */
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

/**
 * Returns the local names that one static import declaration binds,
 * skipping type-only imports.
 * es-module-lexer gives us statement ranges but not bindings.
 * Parsing by hand avoids depending on `@babel/core`,
 * which is only an optional peer of this package.
 */
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
