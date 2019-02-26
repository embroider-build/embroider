import { NodePath } from '@babel/traverse';
import { booleanLiteral } from '@babel/types';
import State from './state';

export default function getConfig(path: NodePath, state: State) {
  if (path.parent.type !== 'CallExpression') {
    throw new Error(`You can only use getConfig as a function call`);
  }
  if (path.parent.arguments.length !== 1) {
    throw new Error(`getConfig takes exactly one argument, you passed ${path.parent.arguments.length}`);
  }
  let [packageName] = path.parent.arguments;
  if (packageName.type !== 'StringLiteral') {
    throw new Error(`the argument to getConfig must be a string literal`);
  }
  path.parentPath.replaceWith(booleanLiteral(false));
  state.removed.push(path.parentPath);
}
