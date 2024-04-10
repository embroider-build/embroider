import type { NodePath } from '@babel/traverse';
import { existsSync } from 'fs';
import type * as Babel from '@babel/core';
import type { types as t } from '@babel/core';
import { dirname } from 'path';
import { explicitRelative, PackageCache } from '.';
import { ImportUtil } from 'babel-import-util';
import makeDebug from 'debug';
import minimatch from 'minimatch';
import { cleanUrl, correspondingTemplate } from './paths';

const debug = makeDebug('embroider:template-colocation-plugin');

export const pluginPath = __filename;

// these options are designed so the defaults are appropriate for use within an
// addon's dev pipeline, whereas when we use it within Embroider we diverge from
// the defaults. That means less options for addon authors to need to know
// about.
export interface Options {
  // Defaults to false.
  //
  // When true, we will only apply changes to components that are owned by
  // packages that are auto-upgraded v2 ember packages. When false, we apply
  // changes to whatever we see.
  //
  // This option is used by Embroider itself to help with compatibility, other
  // users should probably not use it.
  packageGuard?: boolean;

  appRoot: string;

  // Defaults to ['.hbs']
  //
  // Controls how co-located templates are discovered.
  //
  // This option is used by Embroider itself to help with v1 addon
  // compatibility, other users should probably not use it.
  templateExtensions?: string[];

  // Default to []
  //
  // Skip the plugin for files that match the specified globs.
  //
  // This option is used to prevent the plugin to transform the
  // compiled output of hbs files that are not colocated components.
  exclude?: string[];
}

interface State {
  colocatedTemplate: string | undefined;
  associate: { component: t.Identifier; template: t.Identifier } | undefined;
  adder: ImportUtil;
  opts: Options;
}

function setComponentTemplate(target: NodePath<t.Node>, state: State) {
  return state.adder.import(target, '@ember/component', 'setComponentTemplate');
}

export default function main(babel: typeof Babel) {
  let t = babel.types;
  return {
    visitor: {
      Program: {
        enter(path: NodePath<t.Program>, state: State) {
          state.adder = new ImportUtil(t, path);
          let filename = cleanUrl((path.hub as any).file.opts.filename);

          if (state.opts.packageGuard) {
            let owningPackage = PackageCache.shared('embroider', state.opts.appRoot).ownerOfFile(filename);
            if (!owningPackage || !owningPackage.isV2Ember() || !owningPackage.meta['auto-upgraded']) {
              debug('not handling colocation for %s', filename);
              return;
            }
          }

          if (state.opts.exclude?.some(glob => minimatch(correspondingTemplate(filename), glob))) {
            debug('not handling colocation for %s', filename);
            return;
          }

          debug('handling colocation for %s', filename);
          let extensions = state.opts.templateExtensions ?? ['.hbs'];
          for (let ext of extensions) {
            let hbsFilename = filename.replace(/\.\w{1,3}$/, '') + ext;
            debug('checking %s', hbsFilename);
            if (hbsFilename !== filename && existsSync(hbsFilename)) {
              state.colocatedTemplate = hbsFilename;
              debug('found colocated template %s', hbsFilename);
              break;
            }
          }
        },
        exit(path: NodePath<t.Program>, state: State) {
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
        if (state.associate) {
          return;
        }
        let template = getTemplate(path, state);
        if (!template) {
          return;
        }

        let declaration = path.get('declaration').node;

        if (t.isClassDeclaration(declaration)) {
          if (declaration.id != null) {
            state.associate = { template, component: declaration.id };
          } else {
            path.node.declaration = t.callExpression(setComponentTemplate(path, state), [
              template,
              t.classExpression(null, declaration.superClass, declaration.body, declaration.decorators ?? []),
            ]);
          }
        } else if (t.isFunctionDeclaration(declaration)) {
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
          path.node.declaration = t.callExpression(setComponentTemplate(path, state), [template, declaration]);
        }
      },
      ExportNamedDeclaration(path: NodePath<t.ExportNamedDeclaration>, state: State) {
        if (state.associate) {
          return;
        }
        let template = getTemplate(path, state);
        if (!template) {
          return;
        }
        let { node } = path;
        for (let specifier of path.node.specifiers) {
          if (t.isExportDefaultSpecifier(specifier)) {
          } else if (t.isExportSpecifier(specifier)) {
            const name = specifier.exported.type === 'Identifier' ? specifier.exported.name : specifier.exported.value;

            if (name === 'default') {
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

function getTemplate(target: NodePath<t.Node>, state: State) {
  if (state.colocatedTemplate) {
    return state.adder.import(
      target,
      explicitRelative(dirname(state.colocatedTemplate), state.colocatedTemplate),
      'default',
      'TEMPLATE'
    );
  }
}
