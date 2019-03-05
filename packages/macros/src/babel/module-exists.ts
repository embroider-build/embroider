import { NodePath } from '@babel/traverse';
import { booleanLiteral, memberExpression, identifier, callExpression } from '@babel/types';
import State, { sourceFile } from './state';
import error from './error';
import { assertArray } from './evaluate-json';
import resolve  from 'resolve';
import { dirname } from 'path';

export default function moduleExists(path: NodePath, state: State) {
  if (path.parent.type !== 'CallExpression') {
    throw error(path, `You can only use moduleExists as a function call`);
  }
  if (path.parent.arguments.length !== 1) {
    throw error(path.parentPath, `moduleExists takes exactly one argument, you passed ${path.parent.arguments.length}`);
  }
  let [moduleName] = path.parent.arguments;
  if (moduleName.type !== 'StringLiteral') {
    throw error(assertArray(path.parentPath.get('arguments'))[0], `the argument to moduleExists must be a string literal`);
  }
  if (state.opts.owningPackageRoot) {
    // this is classic mode, we compile to a runtime check
    path.parentPath.replaceWith(callExpression(memberExpression(memberExpression(identifier('window'), identifier('require')), identifier('has')), path.parent.arguments));
    return;
  }

  let sourceFileName = sourceFile(path, state);
  try {
    resolve.sync(moduleName.value, { basedir: dirname(sourceFileName) });
    path.parentPath.replaceWith(booleanLiteral(true));
  } catch (err) {
    path.parentPath.replaceWith(booleanLiteral(false));
  }
}
