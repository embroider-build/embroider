import { NodePath } from '@babel/traverse';
import evaluate from './evaluate-json';
import { parse } from '@babel/core';
import {
  CallExpression,
  ForOfStatement,
  identifier,
  File,
  ExpressionStatement,
  Identifier,
  callExpression,
  Expression,
} from '@babel/types';
import error from './error';
import cloneDeep from 'lodash/cloneDeep';
import State from './state';

export type EachPath = NodePath<ForOfStatement> & {
  get(right: 'right'): NodePath<CallExpression>;
};

export function isEachPath(path: NodePath<ForOfStatement>): path is EachPath {
  let right = path.get('right');
  if (right.isCallExpression()) {
    let callee = right.get('callee');
    if (callee.referencesImport('@embroider/macros', 'each')) {
      return true;
    }
  }
  return false;
}

export function prepareEachPath(path: EachPath, state: State) {
  let args = path.get('right').get('arguments');
  if (args.length !== 1) {
    throw error(path, `the each() macro accepts exactly one argument, you passed ${args.length}`);
  }

  let left = path.get('left');
  if (!left.isVariableDeclaration() || left.get('declarations').length !== 1) {
    throw error(left, `the each() macro doesn't support this syntax`);
  }

  let body = path.get('body');
  let varName = (left.get('declarations')[0].get('id') as NodePath<Identifier>).node.name;
  let nameRefs = body.scope.getBinding(varName)!.referencePaths;

  state.pendingEachMacros.push({
    body: path.get('body'),
    nameRefs,
    arg: args[0] as NodePath<Expression>,
  });

  path.replaceWith(callExpression(identifier('_eachMacroPlaceholder_'), [args[0].node]));
}

export function finishEachPath(path: NodePath<CallExpression>, state: State) {
  let resumed = state.pendingEachMacros.pop()!;
  let [arrayPath] = path.get('arguments');
  let array = evaluate(arrayPath);
  if (!array.confident) {
    throw error(resumed.arg, `the argument to the each() macro must be statically known`);
  }

  if (!Array.isArray(array.value)) {
    throw error(resumed.arg, `the argument to the each() macro must be an array`);
  }

  for (let element of array.value) {
    let literalElement = asLiteral(element);
    for (let target of resumed.nameRefs) {
      target.replaceWith(literalElement);
    }
    path.insertBefore(cloneDeep(resumed.body.node));
  }
  path.remove();
}

function asLiteral(value: unknown | undefined) {
  if (typeof value === 'undefined') {
    return identifier('undefined');
  }
  let ast = parse(`a(${JSON.stringify(value)})`, {}) as File;
  let statement = ast.program.body[0] as ExpressionStatement;
  let expression = statement.expression as CallExpression;
  return expression.arguments[0];
}
