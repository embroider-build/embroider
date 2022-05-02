import type * as Babel from '@babel/core';
import type { types as t } from '@babel/core';
import type { NodePath } from '@babel/traverse';
import { preprocess, print } from '@glimmer/syntax';

export interface Options {
  astTransforms?: Array<string | Function>;
}

interface State {
  opts: Options;
  localName: string | undefined;
}

export default function main(babel: typeof Babel) {
  let t = babel.types;

  return {
    visitor: {
      ImportDeclaration(path: NodePath<t.ImportDeclaration>, state: State) {
        if (path.node.source.value !== 'ember-cli-htmlbars') {
          return;
        }

        const specifier = path.node.specifiers.find(
          (s) =>
            t.isImportSpecifier(s) &&
            t.isIdentifier(s.imported) &&
            s.imported.name === 'hbs'
        );

        if (!specifier) {
          return;
        }

        state.localName = specifier.local.name;
      },
      CallExpression(path: NodePath<t.CallExpression>, state: State) {
        const localName = state.localName;

        if (!t.isIdentifier(path.node.callee)) {
          return;
        }

        const callee = path.node.callee;

        if (!localName || callee.name !== localName) {
          return;
        }

        let template = (path.node.arguments[0] as t.StringLiteral).value;

        let options = {
          astTransforms: [],
          ...state.opts,
        };

        const astTransforms = options.astTransforms.map((maybeFunc) => {
          // If it's a string attempt to resolve the path to a module.
          return typeof maybeFunc === 'string'
            ? require(maybeFunc) // eslint-disable-line @typescript-eslint/no-require-imports
            : maybeFunc;
        });

        if (astTransforms.length < 1) {
          return;
        }

        const ast = preprocess(template, {
          plugins: {
            ast: [...astTransforms],
          },
        });

        const augmentedTemplate = print(ast);

        // Create a new stringLiteral with the augmentedTemplate
        path.node.arguments[0] = t.stringLiteral(augmentedTemplate);
      },
    },
  };
}
