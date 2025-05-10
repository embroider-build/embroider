import type { NodePath } from '@babel/traverse';
import type { types as t } from '@babel/core';
import type State from './state';
import error from './error';
import { assertArray } from './evaluate-json';
import { dirname } from 'path';

export default function moduleExists(path: NodePath<t.CallExpression>, state: State): boolean {
  if (path.node.arguments.length !== 1) {
    throw error(path, `moduleExists takes exactly one argument, you passed ${path.node.arguments.length}`);
  }
  let [moduleSpecifier] = path.node.arguments;
  if (moduleSpecifier.type !== 'StringLiteral') {
    throw error(assertArray(path.get('arguments'))[0], `the first argument to moduleExists must be a string literal`);
  }
  try {
    require.resolve(moduleSpecifier.value, { paths: [process.cwd(), state.sourceFile, dirname(state.sourceFile)] });
    return true;
  } catch (err) {
    if (err.code !== 'MODULE_NOT_FOUND') {
      throw err;
    }
    return false;
  }
}
