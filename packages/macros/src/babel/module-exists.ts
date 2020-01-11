import { NodePath } from '@babel/traverse';
import { booleanLiteral, CallExpression } from '@babel/types';
import State, { sourceFile } from './state';
import error from './error';
import { assertArray } from './evaluate-json';
import resolve from 'resolve';
import { dirname } from 'path';

export default function moduleExists(path: NodePath<CallExpression>, state: State) {
  if (path.node.arguments.length !== 1) {
    throw error(path, `moduleExists takes exactly one argument, you passed ${path.node.arguments.length}`);
  }
  let [moduleSpecifier] = path.node.arguments;
  if (moduleSpecifier.type !== 'StringLiteral') {
    throw error(assertArray(path.get('arguments'))[0], `the first argument to moduleExists must be a string literal`);
  }
  let sourceFileName = sourceFile(path, state);
  try {
    resolve.sync(moduleSpecifier.value, { basedir: dirname(sourceFileName) });
    path.replaceWith(booleanLiteral(true));
  } catch (err) {
    if (err.code !== 'MODULE_NOT_FOUND') {
      throw err;
    }
    path.replaceWith(booleanLiteral(false));
  }
}
