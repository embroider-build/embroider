import { NodePath } from '@babel/traverse';
import {
  identifier,
  CallExpression,
  callExpression,
  stringLiteral,
  memberExpression,
  FunctionDeclaration,
  returnStatement,
  Identifier,
} from '@babel/types';
import State, { sourceFile } from './state';
import { PackageCache, Package } from '@embroider/core';
import error from './error';
import { Evaluator, assertArray, buildLiterals, ConfidentResult } from './evaluate-json';

const packageCache = PackageCache.shared('embroider-stage3');

function getPackage(path: NodePath<CallExpression>, state: State, own: boolean): Package | null {
  let packageName: string | undefined;
  if (own) {
    if (path.node.arguments.length !== 0) {
      throw error(path, `getOwnConfig takes zero arguments, you passed ${path.node.arguments.length}`);
    }
    packageName = undefined;
  } else {
    if (path.node.arguments.length !== 1) {
      throw error(path, `getConfig takes exactly one argument, you passed ${path.node.arguments.length}`);
    }
    let packageNode = path.node.arguments[0];
    if (packageNode.type !== 'StringLiteral') {
      throw error(assertArray(path.get('arguments'))[0], `the argument to getConfig must be a string literal`);
    }
    packageName = packageNode.value;
  }
  return targetPackage(sourceFile(path, state), packageName, packageCache);
}

// this evaluates to the actual value of the config. It can be used directly by the Evaluator.
export default function getConfig(path: NodePath<CallExpression>, state: State, own: boolean) {
  let config: unknown | undefined;
  let pkg = getPackage(path, state, own);
  if (pkg) {
    config = state.opts.userConfigs[pkg.root];
  }
  return config;
}

// this is the imperative version that's invoked directly by the babel visitor
// when we encounter getConfig. It's implemented in terms of getConfig so we can
// be sure we have the same semantics.
export function insertConfig(path: NodePath<CallExpression>, state: State, own: boolean) {
  if (state.opts.mode === 'compile-time') {
    let config = getConfig(path, state, own);
    let collapsed = collapse(path, config);
    let literalResult = buildLiterals(collapsed.config);
    collapsed.path.replaceWith(literalResult);
  } else {
    let pkg = getPackage(path, state, own);
    let pkgRoot;
    if (pkg) {
      pkgRoot = stringLiteral(pkg.root);
    } else {
      pkgRoot = identifier('undefined');
    }
    path.replaceWith(
      callExpression(memberExpression(path.get('callee').node as Identifier, identifier('_runtimeGet')), [pkgRoot])
    );
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

export function inlineRuntimeConfig(path: NodePath<FunctionDeclaration>, state: State) {
  path.get('body').node.body = [returnStatement(buildLiterals(state.opts.userConfigs))];
}
