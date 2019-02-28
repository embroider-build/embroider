import resolve from 'resolve';
import { dirname } from 'path';
import { NodePath } from '@babel/traverse';
import { booleanLiteral } from '@babel/types';
import State, { sourceFile } from './state';

export default function modulePresent(path: NodePath, state: State) {
  if (path.parent.type !== 'CallExpression') {
    throw new Error(`You can only use modulePresent as a function call`);
  }
  if (path.parent.arguments.length !== 1) {
    throw new Error(`modulePresent takes exactly one argument, you passed ${path.parent.arguments.length}`);
  }
  let arg = path.parent.arguments[0];
  if (arg.type !== 'StringLiteral') {
    throw new Error(`the argument to modulePresent must be a string literal`);
  }
  let sourceFileName = sourceFile(path, state);
  try {
    resolve.sync(arg.value, { basedir: dirname(sourceFileName) });
    path.parentPath.replaceWith(booleanLiteral(true));
  } catch (err) {
    path.parentPath.replaceWith(booleanLiteral(false));
  }
  state.removed.push(path.parentPath);
}
