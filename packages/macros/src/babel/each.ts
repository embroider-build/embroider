import type { NodePath } from '@babel/traverse';
import { buildLiterals, Evaluator } from './evaluate-json';
import type { CallExpression, ForOfStatement, Identifier } from '@babel/types';
import error from './error';
import State, { cloneDeep } from './state';
import type * as Babel from '@babel/core';

type CallEachExpression = NodePath<CallExpression> & {
  get(callee: 'callee'): NodePath<Identifier>;
};

export type EachPath = NodePath<ForOfStatement> & {
  get(right: 'right'): CallEachExpression;
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

export function insertEach(path: EachPath, state: State, context: typeof Babel) {
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

  let [arrayPath] = args;
  let array = new Evaluator({ state }).evaluate(arrayPath);
  if (!array.confident) {
    throw error(args[0], `the argument to the each() macro must be statically known`);
  }

  if (state.opts.mode === 'compile-time' && !Array.isArray(array.value)) {
    throw error(args[0], `the argument to the each() macro must be an array`);
  }

  if (state.opts.mode === 'run-time') {
    let callee = path.get('right').get('callee');
    state.neededRuntimeImports.set(callee.node.name, 'each');
  } else {
    for (let element of array.value) {
      let literalElement = buildLiterals(element, context);
      for (let target of nameRefs) {
        target.replaceWith(literalElement);
      }
      path.insertBefore(cloneDeep(path.get('body').node, state));
    }
    path.remove();
  }
}
