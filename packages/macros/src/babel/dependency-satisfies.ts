import type { NodePath } from '@babel/traverse';
import type { types as t } from '@babel/core';
import State from './state';
import { satisfies } from 'semver';
import error from './error';
import { assertArray } from './evaluate-json';

export default function dependencySatisfies(path: NodePath<t.CallExpression>, state: State): boolean {
  if (path.node.arguments.length !== 2) {
    throw error(path, `dependencySatisfies takes exactly two arguments, you passed ${path.node.arguments.length}`);
  }
  const [packageName, range] = path.node.arguments;
  if (packageName.type !== 'StringLiteral') {
    throw error(
      assertArray(path.get('arguments'))[0],
      `the first argument to dependencySatisfies must be a string literal`
    );
  }
  if (range.type !== 'StringLiteral') {
    throw error(
      assertArray(path.get('arguments'))[1],
      `the second argument to dependencySatisfies must be a string literal`
    );
  }
  try {
    let us = state.packageCache.ownerOfFile(state.sourceFile);
    if (!us?.hasDependency(packageName.value)) {
      return false;
    }

    let version = state.packageCache.resolve(packageName.value, us).version;
    return satisfies(version, range.value, {
      includePrerelease: true,
    });
  } catch (err) {
    if (err.code !== 'MODULE_NOT_FOUND') {
      throw err;
    }
    return false;
  }
}
