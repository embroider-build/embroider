import type { types as t } from '@babel/core';
import type { NodePath } from '@babel/traverse';

type BabelTypes = typeof t;

// this is intentionally not the whole babel-plugin-ember-modules-api-polyfill.
// That runs very early, so any usage of polyfilled imports that gets emitted by
// our other babel plugins can't take advantage of it.
//
// If I was going to try to do this properly, I would change
// babel-plugin-ember-modules-api-polyfill to run very late in the game, like
// this code does, so that other plugins could always not worry about it. But
// seeing as modules-api-polyfill is already on the way out, it's simpler to
// just handle the small piece of its functionality that matter to us:
//
// - all our usage (emitted by our babel plugins) is static imports, not dynamic
//   ones, so it's OK to just walk the top level, saving us the cost of a full
//   traverse
// - we only emit a handful of specific imports that are easy to just list here
//
//
let replacements: { [moduleSpecifier: string]: { [name: string]: ((t: BabelTypes) => t.Expression) | undefined } } = {
  '@ember/component/template-only': {
    default(t: BabelTypes) {
      return t.memberExpression(t.identifier('Ember'), t.identifier('_templateOnlyComponent'));
    },
  },
  '@ember/template-factory': {
    createTemplateFactory(t) {
      return t.memberExpression(
        t.memberExpression(t.identifier('Ember'), t.identifier('HTMLBars')),
        t.identifier('template')
      );
    },
  },
  '@ember/component': {
    default(t: BabelTypes) {
      return t.memberExpression(t.identifier('Ember'), t.identifier('Component'));
    },
    setComponentTemplate(t: BabelTypes) {
      return t.memberExpression(t.identifier('Ember'), t.identifier('_setComponentTemplate'));
    },
  },
};

export default function miniModulesPolyfill(babel: unknown) {
  let t = (babel as any).types as BabelTypes;
  return {
    visitor: {
      Program: {
        exit(path: NodePath<t.Program>) {
          for (let child of path.get('body')) {
            if (child.isImportDeclaration()) {
              let replacement = handleImportDeclaration(t, child);
              if (replacement) {
                path.replaceWith(replacement);
              }
            }
          }
        },
      },
    },
  };
}

export function handleImportDeclaration(t: BabelTypes, path: NodePath<t.ImportDeclaration>) {
  let match = replacements[path.node.source.value];
  if (match) {
    let specifiers = path.get('specifiers');
    let replacers = specifiers.map(specifier => ({ replacer: match[specifier.node.local.name], specifier }));
    if (replacers.every(r => Boolean(r.replacer))) {
      path.replaceWith(
        t.variableDeclaration(
          'const',
          replacers.map(r => t.variableDeclarator(r.specifier.node.local, r.replacer!(t)))
        )
      );
    } else {
      for (let { specifier, replacer } of replacers) {
        if (replacer) {
          path.insertAfter(t.variableDeclaration('const', [t.variableDeclarator(specifier.node.local, replacer(t))]));
          specifier.remove();
        }
      }
    }
  }
  return undefined;
}
