import { NodePath } from '@babel/traverse';
import { CallExpression } from '@babel/types';
import State from './state';

export interface Visitor {
  CallExpression: (node: NodePath<CallExpression>, state: State) => void;
}

export interface BoundVisitor extends Visitor {
  CallExpression: (node: NodePath<CallExpression>) => void;
}

export function bindState(visitor: Visitor, state: State): BoundVisitor {
  return {
    CallExpression(node: NodePath<CallExpression>) {
      return visitor.CallExpression(node, state);
    },
  };
}
