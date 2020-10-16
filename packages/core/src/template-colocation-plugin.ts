import { NodePath } from '@babel/traverse';
import { existsSync } from 'fs';
import {
  Program,
  ExportDefaultDeclaration,
  callExpression,
  identifier,
  isClassDeclaration,
  classExpression,
  Identifier,
  importDeclaration,
  stringLiteral,
  importDefaultSpecifier,
  memberExpression,
  expressionStatement,
  isFunctionDeclaration,
  isTSDeclareFunction,
  functionExpression,
  ExportNamedDeclaration,
  isExportDefaultSpecifier,
  isExportSpecifier,
  importSpecifier,
} from '@babel/types';
import { dirname } from 'path';
import { explicitRelative } from './paths';
import PackageCache from './package-cache';

const packageCache = PackageCache.shared('embroider-stage3');

interface State {
  colocatedTemplate: string | undefined;
  importTemplateAs: string | undefined;
  associateWithName: string | undefined;
  mustImportComponent: undefined | { source: string; name: string };
}

function unusedNameLike(name: string, path: NodePath<unknown>) {
  let candidate = name;
  let counter = 0;
  while (path.scope.getBinding(candidate)) {
    candidate = `${name}${counter++}`;
  }
  return candidate;
}

function setComponentTemplate() {
  return memberExpression(identifier('Ember'), identifier('_setComponentTemplate'));
}

export default function main() {
  return {
    visitor: {
      Program: {
        enter(path: NodePath<Program>, state: State) {
          let filename = path.hub.file.opts.filename;

          let owningPackage = packageCache.ownerOfFile(filename);
          if (!owningPackage || !owningPackage.isV2Ember() || !owningPackage.meta['auto-upgraded']) {
            return;
          }

          let hbsFilename = filename.replace(/\.\w{1,3}$/, '') + '.hbs';
          if (existsSync(hbsFilename)) {
            state.colocatedTemplate = hbsFilename;
          }
        },
        exit(path: NodePath<Program>, state: State) {
          if (!state.colocatedTemplate) {
            return;
          }
          if (state.importTemplateAs) {
            path.node.body.unshift(
              importDeclaration(
                [importDefaultSpecifier(identifier(state.importTemplateAs))],
                stringLiteral(explicitRelative(dirname(state.colocatedTemplate), state.colocatedTemplate))
              )
            );
          }
          if (state.mustImportComponent) {
            state.associateWithName = unusedNameLike('COMPONENT', path);
            let specifier;
            if (state.mustImportComponent.name === 'default') {
              specifier = importDefaultSpecifier(identifier(state.associateWithName));
            } else {
              specifier = importSpecifier(
                identifier(state.associateWithName),
                identifier(state.mustImportComponent.name)
              );
            }
            path.node.body.push(importDeclaration([specifier], stringLiteral(state.mustImportComponent.source)));
          }
          if (state.associateWithName && state.importTemplateAs) {
            path.node.body.push(
              expressionStatement(
                callExpression(setComponentTemplate(), [
                  identifier(state.importTemplateAs),
                  identifier(state.associateWithName),
                ])
              )
            );
          }
        },
      },
      ExportDefaultDeclaration(path: NodePath<ExportDefaultDeclaration>, state: State) {
        if (!state.colocatedTemplate) {
          return;
        }

        let declaration = path.get('declaration').node;

        if (isClassDeclaration(declaration)) {
          state.importTemplateAs = unusedNameLike('TEMPLATE', path);
          if (declaration.id != null) {
            state.associateWithName = declaration.id.name;
          } else {
            path.node.declaration = callExpression(setComponentTemplate(), [
              identifier(state.importTemplateAs),
              classExpression(null, declaration.superClass, declaration.body, declaration.decorators),
            ]);
          }
        } else if (isFunctionDeclaration(declaration)) {
          state.importTemplateAs = unusedNameLike('TEMPLATE', path);

          if (declaration.id != null) {
            state.associateWithName = declaration.id.name;
          } else {
            path.node.declaration = callExpression(setComponentTemplate(), [
              identifier(state.importTemplateAs),
              functionExpression(null, declaration.params, declaration.body, declaration.generator, declaration.async),
            ]);
          }
        } else if (isTSDeclareFunction(declaration)) {
          // we don't rewrite this
        } else {
          state.importTemplateAs = unusedNameLike('TEMPLATE', path);
          path.node.declaration = callExpression(setComponentTemplate(), [
            identifier(state.importTemplateAs),
            declaration,
          ]);
        }
      },
      ExportNamedDeclaration(path: NodePath<ExportNamedDeclaration>, state: State) {
        if (!state.colocatedTemplate) {
          return;
        }
        let { node } = path;
        for (let specifier of path.node.specifiers) {
          if (isExportDefaultSpecifier(specifier)) {
          } else if (isExportSpecifier(specifier)) {
            if ((specifier.exported as Identifier).name === 'default') {
              state.importTemplateAs = unusedNameLike('TEMPLATE', path);
              if (node.source) {
                // our default export is a reexport from elsewhere. We will
                // synthesize a new import for it so we can get a local handle
                // on it
                state.mustImportComponent = { source: node.source.value, name: specifier.local.name };
              } else {
                // our default export is one of our local names
                state.associateWithName = specifier.local.name;
              }
            }
          }
        }
      },
    },
  };
}
