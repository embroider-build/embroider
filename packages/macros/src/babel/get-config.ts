import type { NodePath } from '@babel/traverse';
import type { CallExpression, FunctionDeclaration } from '@babel/types';
import State, { sourceFile, unusedNameLike } from './state';
import { PackageCache, Package } from '@embroider/shared-internals';
import error from './error';
import { Evaluator, assertArray, buildLiterals, ConfidentResult } from './evaluate-json';
import assertNever from 'assert-never';
import type * as Babel from '@babel/core';

const packageCache = PackageCache.shared('embroider-stage3');
export type Mode = 'own' | 'getGlobalConfig' | 'package';

function getPackage(path: NodePath<CallExpression>, state: State, mode: 'own' | 'package'): { root: string } | null {
  let packageName: string | undefined;
  if (mode === 'own') {
    if (path.node.arguments.length !== 0) {
      throw error(path, `getOwnConfig takes zero arguments, you passed ${path.node.arguments.length}`);
    }
    packageName = undefined;
  } else if (mode === 'package') {
    if (path.node.arguments.length !== 1) {
      throw error(path, `getConfig takes exactly one argument, you passed ${path.node.arguments.length}`);
    }
    let packageNode = path.node.arguments[0];
    if (packageNode.type !== 'StringLiteral') {
      throw error(assertArray(path.get('arguments'))[0], `the argument to getConfig must be a string literal`);
    }
    packageName = packageNode.value;
  } else {
    assertNever(mode);
  }
  return targetPackage(sourceFile(path, state), packageName, packageCache);
}

// this evaluates to the actual value of the config. It can be used directly by the Evaluator.
export default function getConfig(path: NodePath<CallExpression>, state: State, mode: Mode) {
  let config: unknown | undefined;
  if (mode === 'getGlobalConfig') {
    return state.opts.globalConfig;
  }
  let pkg = getPackage(path, state, mode);
  if (pkg) {
    config = state.opts.userConfigs[pkg.root];
  }
  return config;
}

// this is the imperative version that's invoked directly by the babel visitor
// when we encounter getConfig. It's implemented in terms of getConfig so we can
// be sure we have the same semantics.
export function insertConfig(path: NodePath<CallExpression>, state: State, mode: Mode, context: typeof Babel) {
  if (state.opts.mode === 'compile-time') {
    let config = getConfig(path, state, mode);
    let collapsed = collapse(path, config);
    let literalResult = buildLiterals(collapsed.config, context);
    collapsed.path.replaceWith(literalResult);
  } else {
    if (mode === 'getGlobalConfig') {
      state.neededRuntimeImports.set(calleeName(path, context), 'getGlobalConfig');
    } else {
      let pkg = getPackage(path, state, mode);
      let pkgRoot;
      if (pkg) {
        pkgRoot = context.types.stringLiteral(pkg.root);
      } else {
        pkgRoot = context.types.identifier('undefined');
      }
      let name = unusedNameLike('config', path);
      path.replaceWith(context.types.callExpression(context.types.identifier(name), [pkgRoot]));
      state.neededRuntimeImports.set(name, 'config');
    }
  }
}

function targetPackage(fromPath: string, packageName: string | undefined, packageCache: PackageCache): Package | null {
  let us = packageCache.ownerOfFile(fromPath);
  if (!us) {
    throw new Error(`unable to determine which npm package owns the file ${fromPath}`);
  }
  if (!packageName) {
    return us;
  }
  try {
    return packageCache.resolve(packageName, us);
  } catch (err) {
    return null;
  }
}

function collapse(path: NodePath, config: any) {
  let evaluator = new Evaluator({ knownPaths: new Map([[path, { confident: true, value: config }]]) });

  while (true) {
    let parentPath = path.parentPath;
    let result = evaluator.evaluate(parentPath);
    if (!result.confident || parentPath.isAssignmentExpression()) {
      return { path, config: (evaluator.evaluate(path) as ConfidentResult).value };
    }
    path = parentPath;
  }
}

export function inlineRuntimeConfig(path: NodePath<FunctionDeclaration>, state: State, context: typeof Babel) {
  path.get('body').node.body = [
    context.types.returnStatement(
      buildLiterals({ packages: state.opts.userConfigs, global: state.opts.globalConfig }, context)
    ),
  ];
}

function calleeName(path: NodePath<CallExpression>, context: typeof Babel): string {
  let callee = path.node.callee;
  if (context.types.isIdentifier(callee)) {
    return callee.name;
  }
  throw new Error(`bug: our macros should only be invoked as identifiers`);
}
