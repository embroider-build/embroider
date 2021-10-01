import type { NodePath } from '@babel/traverse';
import { existsSync } from 'fs';
import type * as t from '@babel/types';
import { dirname } from 'path';
import { explicitRelative } from '@embroider/shared-internals';
import { PackageCache } from '@embroider/shared-internals';
import { ImportUtil } from 'babel-import-util';

type BabelTypes = typeof t;

const packageCache = PackageCache.shared('embroider-stage3');

interface State {
  colocatedTemplate: string | undefined;
  associate: { component: t.Identifier; template: t.Identifier } | undefined;
  adder: ImportUtil;
}

function setComponentTemplate(target: NodePath<t.Node>, state: State) {
  return state.adder.import(target, '@ember/component', 'setComponentTemplate');
}

export default function main(babel: unknown) {
  let t = (babel as any).types as BabelTypes;
  return {
    visitor: {
      Program: {
        enter(path: NodePath<t.Program>, state: State) {
          state.adder = new ImportUtil(t, path);
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
        exit(path: NodePath<t.Program>, state: State) {
          if (!state.colocatedTemplate) {
            return;
          }
          if (state.associate) {
            path.node.body.push(
              t.expressionStatement(
                t.callExpression(setComponentTemplate(path, state), [
                  state.associate.template,
                  state.associate.component,
                ])
              )
            );
          }
        },
      },

      ExportDefaultDeclaration(path: NodePath<t.ExportDefaultDeclaration>, state: State) {
        if (!state.colocatedTemplate) {
          return;
        }

        let declaration = path.get('declaration').node;

        if (t.isClassDeclaration(declaration)) {
          let template = importTemplate(path, state.adder, state.colocatedTemplate);
          if (declaration.id != null) {
            state.associate = { template, component: declaration.id };
          } else {
            path.node.declaration = t.callExpression(setComponentTemplate(path, state), [
              template,
              t.classExpression(null, declaration.superClass, declaration.body, declaration.decorators ?? []),
            ]);
          }
        } else if (t.isFunctionDeclaration(declaration)) {
          let template = importTemplate(path, state.adder, state.colocatedTemplate);

          if (declaration.id != null) {
            state.associate = { template, component: declaration.id };
          } else {
            path.node.declaration = t.callExpression(setComponentTemplate(path, state), [
              template,
              t.functionExpression(
                null,
                declaration.params,
                declaration.body,
                declaration.generator,
                declaration.async
              ),
            ]);
          }
        } else if (t.isTSDeclareFunction(declaration)) {
          // we don't rewrite this
        } else {
          let local = importTemplate(path, state.adder, state.colocatedTemplate);
          path.node.declaration = t.callExpression(setComponentTemplate(path, state), [local, declaration]);
        }
      },
      ExportNamedDeclaration(path: NodePath<t.ExportNamedDeclaration>, state: State) {
        if (!state.colocatedTemplate) {
          return;
        }
        let { node } = path;
        for (let specifier of path.node.specifiers) {
          if (t.isExportDefaultSpecifier(specifier)) {
          } else if (t.isExportSpecifier(specifier)) {
            const name = specifier.exported.type === 'Identifier' ? specifier.exported.name : specifier.exported.value;

            if (name === 'default') {
              let template = importTemplate(path, state.adder, state.colocatedTemplate);
              if (node.source) {
                // our default export is a reexport from elsewhere. We will
                // synthesize a new import for it so we can get a local handle
                // on it
                let component = state.adder.import(path, node.source.value, specifier.local.name, 'COMPONENT');
                state.associate = { template, component };
              } else {
                // our default export is one of our local names
                state.associate = { template, component: t.identifier(specifier.local.name) };
              }
            }
          }
        }
      },
    },
  };
}

function importTemplate(target: NodePath<t.Node>, adder: ImportUtil, colocatedTemplate: string) {
  return adder.import(target, explicitRelative(dirname(colocatedTemplate), colocatedTemplate), 'default', 'TEMPLATE');
}
