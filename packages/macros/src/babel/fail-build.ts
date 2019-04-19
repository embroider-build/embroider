import { NodePath } from '@babel/traverse';
import evaluateJSON from './evaluate-json';
import { CallExpression } from '@babel/types';
import error from './error';
import { BoundVisitor } from './visitor';
import { format } from 'util';

export default function failBuild(path: NodePath<CallExpression>, visitor: BoundVisitor) {
  let args = path.get('arguments');
  if (args.length < 1) {
    throw error(path, `failBuild needs at least one argument`);
  }

  let argValues = args.map(a => evaluate(a, visitor));
  for (let i = 0; i < argValues.length; i++) {
    if (!argValues[i].confident) {
      throw error(args[i], `the arguments to failBuild must be statically known`);
    }
  }

  let [message, ...rest] = argValues;
  throw new Error(format(`failBuild: ${message.value}`, ...rest.map(r => r.value)));
}

function evaluate(path: NodePath, visitor: BoundVisitor) {
  let builtIn = path.evaluate();
  if (builtIn.confident) {
    return builtIn;
  }
  return evaluateJSON(path, visitor);
}
