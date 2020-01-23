import { NodePath } from '@babel/traverse';
import { existsSync } from 'fs';
import {
  Program,
  ExportDefaultDeclaration,
  callExpression,
  identifier,
  isClassDeclaration,
  classExpression,
  importDeclaration,
  stringLiteral,
  importSpecifier,
  memberExpression,
} from '@babel/types';
import { dirname } from 'path';
import { explicitRelative } from './paths';

interface State {
  colocatedTemplate: string | undefined;
  importTemplateAs: string | undefined;
}

function unusedNameLike(name: string, path: NodePath<unknown>) {
  let candidate = name;
  let counter = 0;
  while (candidate in path.scope.bindings) {
    candidate = `${name}${counter++}`;
  }
  return candidate;
}

export default function main() {
  return {
    visitor: {
      Program: {
        enter(path: NodePath<Program>, state: State) {
          let filename = path.hub.file.opts.filename;

          let hbsFilename = filename.replace(/\.\w{1,3}$/, '') + '.hbs';
          if (existsSync(hbsFilename)) {
            state.colocatedTemplate = hbsFilename;
          }
        },
        exit(path: NodePath<Program>, state: State) {
          if (state.importTemplateAs && state.colocatedTemplate) {
            path.node.body.unshift(
              importDeclaration(
                [importSpecifier(identifier(state.importTemplateAs), identifier('TEMPLATE'))],
                stringLiteral(explicitRelative(dirname(state.colocatedTemplate), state.colocatedTemplate))
              )
            );
          }
        },
      },
      ExportDefaultDeclaration(path: NodePath<ExportDefaultDeclaration>, state: State) {
        if (!state.colocatedTemplate) {
          return;
        }

        state.importTemplateAs = unusedNameLike('TEMPLATE', path);
        let setter = memberExpression(identifier('Ember'), identifier('_setComponentTemplate'));
        let declaration = path.get('declaration').node;

        if (isClassDeclaration(declaration)) {
          if (declaration.id != null) {
            throw new Error(`unimplemented`);
          } else {
            path.node.declaration = callExpression(setter, [
              identifier(state.importTemplateAs),
              classExpression(null, declaration.superClass, declaration.body, declaration.decorators),
            ]);
          }
        } else {
          throw new Error(`unimplemented 2`);
        }
      },
    },
  };
}
