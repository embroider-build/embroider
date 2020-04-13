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
  OptionalMemberExpression,
} from '@babel/types';
import State, { sourceFile } from './state';
import { PackageCache, Package } from '@embroider/core';
import error from './error';
import evaluate, { assertArray, buildLiterals, ConfidentResult } from './evaluate-json';

export default function getConfig(
  path: NodePath<CallExpression>,
  state: State,
  packageCache: PackageCache,
  own: boolean
) {
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
  let config: unknown | undefined;
  let pkg = targetPackage(sourceFile(path, state), packageName, packageCache);
  if (state.opts.mode === 'compile-time') {
    if (pkg) {
      config = state.opts.userConfigs[pkg.root];
    }
    let collapsed = collapse(path, config);
    let literalResult = buildLiterals(collapsed.config);
    collapsed.path.replaceWith(literalResult);
  } else {
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
  let knownPaths: Map<NodePath, ConfidentResult> = new Map([[path, { confident: true, value: config }]]);
  let context = {};
  while (true) {
    let parentPath = path.parentPath;
    if (parentPath.isMemberExpression()) {
      if (parentPath.get('object').node !== path.node) {
        return { path, config };
      }
    } else if (parentPath.node.type === 'OptionalMemberExpression') {
      let castParentPath = parentPath as NodePath<OptionalMemberExpression>;
      if (castParentPath.get('object').node !== path.node) {
        return { path, config };
      }
    }
    let result = evaluate(parentPath, context, knownPaths);
    if (!result.confident) {
      if (path.isAssignmentExpression()) {
        return { path: path.get('right'), config: knownPaths.get(path)!.value };
      }
      return { path, config: knownPaths.get(path)!.value };
    }
    knownPaths.set(parentPath, result);
    path = parentPath;
  }
}

export function inlineRuntimeConfig(path: NodePath<FunctionDeclaration>, state: State) {
  path.get('body').node.body = [returnStatement(buildLiterals(state.opts.userConfigs))];
}
