import { dirname, join } from 'path';
import type { NodePath } from '@babel/traverse';
import type * as Babel from '@babel/core';
import type { types as t } from '@babel/core';
import { ImportUtil } from 'babel-import-util';
import { Options, Resolver } from './module-resolver';
import assertNever from 'assert-never';
import { explicitRelative } from '@embroider/shared-internals';

interface State {
  resolver: Resolver;
  opts: Options | DeflatedOptions;
}

export { Options };

export interface DeflatedOptions {
  adjustImportsOptionsPath: string;
  relocatedFilesPath: string;
}

type BabelTypes = typeof t;

type DefineExpressionPath = NodePath<t.CallExpression> & {
  node: t.CallExpression & {
    arguments: [t.StringLiteral, t.ArrayExpression, Function];
  };
};

export function isImportSyncExpression(t: BabelTypes, path: NodePath<any>) {
  if (
    !path ||
    !path.isCallExpression() ||
    path.node.callee.type !== 'Identifier' ||
    !path.get('callee').referencesImport('@embroider/macros', 'importSync')
  ) {
    return false;
  }

  const args = path.node.arguments;
  return Array.isArray(args) && args.length === 1 && t.isStringLiteral(args[0]);
}

export function isDynamicImportExpression(t: BabelTypes, path: NodePath<any>) {
  if (!path || !path.isCallExpression() || path.node.callee.type !== 'Import') {
    return false;
  }

  const args = path.node.arguments;
  return Array.isArray(args) && args.length === 1 && t.isStringLiteral(args[0]);
}

export function isDefineExpression(t: BabelTypes, path: NodePath<any>): path is DefineExpressionPath {
  // should we allow nested defines, or stop at the top level?
  if (!path.isCallExpression() || path.node.callee.type !== 'Identifier' || path.node.callee.name !== 'define') {
    return false;
  }

  const args = path.node.arguments;

  // only match define with 3 arguments define(name: string, deps: string[], cb: Function);
  return (
    Array.isArray(args) &&
    args.length === 3 &&
    t.isStringLiteral(args[0]) &&
    t.isArrayExpression(args[1]) &&
    t.isFunction(args[2])
  );
}

export default function main(babel: typeof Babel) {
  let t = babel.types;
  return {
    visitor: {
      Program: {
        enter(path: NodePath<t.Program>, state: State) {
          let opts = ensureOpts(state);
          state.resolver = new Resolver(path.hub.file.opts.filename, opts);
          let adder = new ImportUtil(t, path);
          addExtraImports(adder, t, path, opts.extraImports);
        },
        exit(path: NodePath<t.Program>, state: State) {
          for (let child of path.get('body')) {
            if (child.isImportDeclaration() || child.isExportNamedDeclaration() || child.isExportAllDeclaration()) {
              rewriteTopLevelImport(child, state);
            }
          }
        },
      },
      CallExpression(path: NodePath<t.CallExpression>, state: State) {
        if (isImportSyncExpression(t, path) || isDynamicImportExpression(t, path)) {
          const [source] = path.get('arguments');
          resolve((source.node as any).value, state, newSpecifier => {
            source.replaceWith(t.stringLiteral(newSpecifier));
          });
          return;
        }

        // Should/can we make this early exit when the first define was found?
        if (!isDefineExpression(t, path)) {
          return;
        }

        let pkg = state.resolver.owningPackage();
        if (pkg && pkg.isV2Ember() && !pkg.meta['auto-upgraded']) {
          throw new Error(
            `The file ${state.resolver.originalFilename} in package ${pkg.name} tried to use AMD define. Native V2 Ember addons are forbidden from using AMD define, they must use ECMA export only.`
          );
        }

        const dependencies = path.node.arguments[1];

        const specifiers = dependencies.elements.slice();
        specifiers.push(path.node.arguments[0]);

        for (const source of specifiers) {
          if (!source) {
            continue;
          }

          if (source.type !== 'StringLiteral') {
            throw path.buildCodeFrameError(`expected only string literal arguments`);
          }

          if (source.value === 'exports' || source.value === 'require') {
            // skip "special" AMD dependencies
            continue;
          }

          resolve(source.value, state, newSpecifier => {
            source.value = newSpecifier;
          });
        }
      },
    },
  };
}

function rewriteTopLevelImport(
  path: NodePath<t.ImportDeclaration | t.ExportNamedDeclaration | t.ExportAllDeclaration>,
  state: State
) {
  const { source } = path.node;
  if (source === null || source === undefined) {
    return;
  }

  resolve(source.value, state, newSpecifier => {
    source.value = newSpecifier;
  });
}

(main as any).baseDir = function () {
  return join(__dirname, '..');
};

function addExtraImports(
  adder: ImportUtil,
  t: BabelTypes,
  path: NodePath<t.Program>,
  extraImports: Required<Options>['extraImports']
) {
  for (let { absPath, target, runtimeName } of extraImports) {
    if (absPath === path.hub.file.opts.filename) {
      if (runtimeName) {
        path.node.body.unshift(amdDefine(t, adder, path, target, runtimeName));
      } else {
        adder.importForSideEffect(target);
      }
    }
  }
}

function amdDefine(t: BabelTypes, adder: ImportUtil, path: NodePath<t.Program>, target: string, runtimeName: string) {
  let value = t.callExpression(adder.import(path, '@embroider/macros', 'importSync'), [t.stringLiteral(target)]);
  return t.expressionStatement(
    t.callExpression(t.memberExpression(t.identifier('window'), t.identifier('define')), [
      t.stringLiteral(runtimeName),
      t.functionExpression(null, [], t.blockStatement([t.returnStatement(value)])),
    ])
  );
}

function ensureOpts(state: State): Options {
  let { opts } = state;
  if ('adjustImportsOptionsPath' in opts) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return (state.opts = { ...require(opts.adjustImportsOptionsPath), ...require(opts.relocatedFilesPath) });
  }
  return opts;
}

function resolve(specifier: string, state: State, setter: (specifier: string) => void) {
  let resolution = state.resolver.resolve(specifier);
  switch (resolution.result) {
    case 'redirect-to':
      setter(explicitRelative(dirname(state.resolver.filename), resolution.specifier));
      break;
    case 'continue':
    case 'external':
      return;
    default:
      throw assertNever(resolution);
  }
}
