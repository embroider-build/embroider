import { join, dirname } from 'path';
import type { NodePath } from '@babel/traverse';
import type * as Babel from '@babel/core';
import type { types as t } from '@babel/core';
import { ImportUtil } from 'babel-import-util';
import { randomBytes } from 'crypto';
import { outputFileSync, pathExistsSync, renameSync } from 'fs-extra';
import { explicitRelative } from '@embroider/shared-internals';
import { compile } from './js-handlebars';
import { Options, Resolver } from './module-resolver';
import assertNever from 'assert-never';

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
          resolve((source.node as any).value, true, state, newSpecifier => {
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

          resolve(source.value, false, state, newSpecifier => {
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

  resolve(source.value, false, state, newSpecifier => {
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

function makeExternal(specifier: string, sourceFile: string, opts: Options): string {
  let target = join(opts.externalsDir, specifier + '.js');
  atomicWrite(
    target,
    externalTemplate({
      runtimeName: specifier,
    })
  );
  return explicitRelative(dirname(sourceFile), target.slice(0, -3));
}

function atomicWrite(path: string, content: string) {
  if (pathExistsSync(path)) {
    return;
  }
  let suffix = randomBytes(8).toString('hex');
  outputFileSync(path + suffix, content);
  try {
    renameSync(path + suffix, path);
  } catch (err: any) {
    // windows throws EPERM for concurrent access. For us it's not an error
    // condition because the other thread is writing the exact same value we
    // would have.
    if (err.code !== 'EPERM') {
      throw err;
    }
  }
}

function makeMissingModule(specifier: string, sourceFile: string, opts: Options): string {
  let target = join(opts.externalsDir, 'missing', specifier + '.js');
  atomicWrite(
    target,
    dynamicMissingModule({
      moduleName: specifier,
    })
  );
  return explicitRelative(dirname(sourceFile), target.slice(0, -3));
}

const dynamicMissingModule = compile(`
  throw new Error('Could not find module \`{{{js-string-escape moduleName}}}\`');
`) as (params: { moduleName: string }) => string;

const externalTemplate = compile(`
{{#if (eq runtimeName "require")}}
const m = window.requirejs;
{{else}}
const m = window.require("{{{js-string-escape runtimeName}}}");
{{/if}}
{{!-
  There are plenty of hand-written AMD defines floating around
  that lack this, and they will break when other build systems
  encounter them.

  As far as I can tell, Ember's loader was already treating this
  case as a module, so in theory we aren't breaking anything by
  marking it as such when other packagers come looking.

  todo: get review on this part.
-}}
if (m.default && !m.__esModule) {
  m.__esModule = true;
}
module.exports = m;
`) as (params: { runtimeName: string }) => string;

function resolve(specifier: string, isDynamic: boolean, state: State, setter: (specifier: string) => void) {
  let resolution = state.resolver.resolve(specifier, isDynamic);
  let newSpecifier: string | undefined;
  switch (resolution.result) {
    case 'continue':
      return;
    case 'external':
      newSpecifier = makeExternal(resolution.specifier, state.resolver.filename, ensureOpts(state));
      break;
    case 'redirect-to':
      newSpecifier = resolution.specifier;
      break;
    case 'runtime-failure':
      newSpecifier = makeMissingModule(resolution.specifier, state.resolver.filename, ensureOpts(state));
      break;
    default:
      throw assertNever(resolution);
  }
  if (newSpecifier) {
    setter(newSpecifier);
  }
}
