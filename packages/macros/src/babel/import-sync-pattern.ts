import type * as Babel from '@babel/core';
import type { types as t } from '@babel/core';

type Types = typeof Babel.types;

/*
  Support for `importSync` with a dynamic path, like:

     importSync(`../components/results/${type}-result`)

  In eager mode we can't do a truly dynamic import, so we expand the call into a
  lookup table over the real contents of the directory. To do that correctly we
  need to understand the *whole* pattern, not just the part before the first
  interpolation.
*/

export type PatternPart = { type: 'static'; value: string } | { type: 'dynamic'; value: t.Expression };

// A parsed `importSync` specifier: the statically-known directory that we will
// read, plus the pattern that filenames within it must match.
export interface ParsedSpecifier {
  // always ends in "/", always starts with "." (we only support relative paths)
  dir: string;
  // the filename pattern, with the file extension (if any) already removed, so
  // it lines up with the extension-less keys we put in the lookup table
  pattern: PatternPart[];
}

// Turns a specifier expression into a flat list of static and dynamic parts.
// Returns undefined if this isn't a shape we understand.
export function patternParts(types: Types, specifier: t.Node): PatternPart[] | undefined {
  if (specifier.type === 'TemplateLiteral') {
    let parts: PatternPart[] = [];
    for (let [index, quasi] of specifier.quasis.entries()) {
      parts.push({ type: 'static', value: quasi.value.cooked! });
      let expression = specifier.expressions[index];
      if (expression) {
        if (!types.isExpression(expression)) {
          return undefined;
        }
        parts.push({ type: 'dynamic', value: expression });
      }
    }
    return normalize(parts);
  }

  // babel might transform the template form `../my-path/${id}` into
  // '../my-path/'.concat(id)
  if (
    specifier.type === 'CallExpression' &&
    specifier.callee.type === 'MemberExpression' &&
    specifier.callee.property.type === 'Identifier' &&
    specifier.callee.property.name === 'concat' &&
    specifier.callee.object.type === 'StringLiteral'
  ) {
    let parts: PatternPart[] = [{ type: 'static', value: specifier.callee.object.value }];
    for (let arg of specifier.arguments) {
      if (arg.type === 'StringLiteral') {
        parts.push({ type: 'static', value: arg.value });
      } else if (types.isExpression(arg)) {
        parts.push({ type: 'dynamic', value: arg });
      } else {
        return undefined;
      }
    }
    return normalize(parts);
  }

  return undefined;
}

// merges adjacent static parts and drops empty ones, so that the rest of the
// code can assume statics are maximal and non-empty
function normalize(parts: PatternPart[]): PatternPart[] {
  let output: PatternPart[] = [];
  for (let part of parts) {
    if (part.type === 'static') {
      if (part.value === '') {
        continue;
      }
      let previous = output[output.length - 1];
      if (previous?.type === 'static') {
        output[output.length - 1] = { type: 'static', value: previous.value + part.value };
        continue;
      }
    }
    output.push(part);
  }
  return output;
}

// Splits the parts into the directory we're going to read and the pattern that
// entries in it need to match. Returns undefined when the parts don't describe
// a relative path with a statically-known directory.
export function parseSpecifier(parts: PatternPart[]): ParsedSpecifier | undefined {
  let first = parts[0];
  if (first?.type !== 'static' || !first.value.startsWith('.')) {
    return undefined;
  }
  let slash = first.value.lastIndexOf('/');
  if (slash === -1) {
    return undefined;
  }
  let dir = first.value.slice(0, slash + 1);
  let head = first.value.slice(slash + 1);
  let pattern = normalize([{ type: 'static', value: head }, ...parts.slice(1)]);

  // The directory we read is only one level deep, so a "/" anywhere later in
  // the pattern could never match one of its entries.
  if (pattern.some(part => part.type === 'static' && part.value.includes('/'))) {
    return undefined;
  }

  return { dir, pattern: withoutExtension(pattern) };
}

// The lookup table is keyed by extension-less filenames, because that's what we
// hand to the resolver. So if the author wrote the extension (which is what
// Vite's own dynamic import rules ask for) we drop it from the pattern too.
function withoutExtension(pattern: PatternPart[]): PatternPart[] {
  let last = pattern[pattern.length - 1];
  if (last?.type !== 'static') {
    return pattern;
  }
  let stripped = last.value.replace(/\.\w+$/, '');
  if (stripped === last.value) {
    return pattern;
  }
  return normalize([...pattern.slice(0, -1), { type: 'static', value: stripped }]);
}

// The key we use for a directory entry: its name minus the file extension.
export function entryKey(entry: string): string {
  let dot = entry.lastIndexOf('.');
  return dot === -1 ? entry : entry.slice(0, dot);
}

// Which keys could this pattern actually select? Everything else in the
// directory would be dead weight in the bundle.
export function patternMatcher(pattern: PatternPart[]): (key: string) => boolean {
  let source =
    '^' + pattern.map(part => (part.type === 'static' ? escapeRegExp(part.value) : '[\\s\\S]*')).join('') + '$';
  let regex = new RegExp(source);
  return key => regex.test(key);
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Builds the expression we use to index into the lookup table. When the pattern
// is a single interpolation (the only shape that used to work) this is just that
// expression, so existing call sites compile to byte-identical output.
export function lookupExpression(types: Types, pattern: PatternPart[]): t.Expression {
  if (pattern.length === 1 && pattern[0].type === 'dynamic') {
    return pattern[0].value;
  }
  let quasis: t.TemplateElement[] = [];
  let expressions: t.Expression[] = [];
  let pending = '';
  for (let part of pattern) {
    if (part.type === 'static') {
      pending += part.value;
    } else {
      quasis.push(types.templateElement({ raw: escapeTemplate(pending), cooked: pending }));
      pending = '';
      expressions.push(part.value);
    }
  }
  quasis.push(types.templateElement({ raw: escapeTemplate(pending), cooked: pending }, true));
  return types.templateLiteral(quasis, expressions);
}

function escapeTemplate(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
}

// path.join() will strip a leading "./", which would turn our relative path
// into a bare package specifier.
export function relativeSpecifier(path: string): string {
  let normalized = path.replace(/\\/g, '/');
  return normalized.startsWith('.') ? normalized : './' + normalized;
}
