import { NodePath } from '@babel/traverse';
import {
  identifier,
  File,
  ExpressionStatement,
  CallExpression,
  Expression,
  OptionalMemberExpression,
  callExpression,
  stringLiteral,
  memberExpression,
  FunctionDeclaration,
  returnStatement,
  Identifier,
  ObjectExpression,
} from '@babel/types';
import { parse } from '@babel/core';
import State, { sourceFile } from './state';
import { PackageCache, Package } from '@embroider/core';
import error from './error';
import evaluate, { assertArray } from './evaluate-json';

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
    collapsed.path.replaceWith(literalConfig(collapsed.config));
  } else {
    let pkgRoot;
    if (pkg) {
      pkgRoot = stringLiteral(pkg.root);
    } else {
      pkgRoot = identifier('undefined');
    }
    path.replaceWith(callExpression(memberExpression(path.get('callee').node, identifier('_runtimeGet')), [pkgRoot]));
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

function literalConfig(config: unknown | undefined): Identifier | ObjectExpression {
  if (typeof config === 'undefined') {
    return identifier('undefined');
  }
  let ast = parse(`a(${JSON.stringify(config)})`, {}) as File;
  let statement = ast.program.body[0] as ExpressionStatement;
  let expression = statement.expression as CallExpression;
  return expression.arguments[0] as ObjectExpression;
}

function collapse(path: NodePath<Expression>, config: any) {
  while (true) {
    let parentPath = path.parentPath;
    if (parentPath.isMemberExpression() && parentPath.get('object').node === path.node) {
      let property = parentPath.get('property') as NodePath;
      if (parentPath.node.computed) {
        let evalProperty = evaluate(property);
        if (evalProperty.confident) {
          config = config[evalProperty.value];
          path = parentPath;
          continue;
        }
      } else {
        if (property.isIdentifier()) {
          config = config[property.node.name];
          path = parentPath;
          continue;
        }
      }
    } else if (parentPath.node.type === 'OptionalMemberExpression') {
      let castParentPath = parentPath as NodePath<OptionalMemberExpression>;
      if (castParentPath.get('object').node === path.node) {
        let property = castParentPath.get('property') as NodePath;
        if (castParentPath.node.computed) {
          let evalProperty = evaluate(property);
          if (evalProperty.confident) {
            config = config == null ? config : config[evalProperty.value];
            path = castParentPath;
            continue;
          }
        } else {
          if (property.isIdentifier()) {
            config = config == null ? config : config[property.node.name];
            path = castParentPath;
            continue;
          }
        }
      }
    }
    break;
  }
  return { path, config };
}

export function inlineRuntimeConfig(path: NodePath<FunctionDeclaration>, state: State) {
  path.get('body').node.body = [returnStatement(literalConfig(state.opts.userConfigs))];
}
