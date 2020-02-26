import { NodePath } from '@babel/traverse';
import { booleanLiteral, CallExpression } from '@babel/types';
import State, { sourceFile } from './state';
import { satisfies } from 'semver';
import { PackageCache } from '@embroider/core';
import error from './error';
import { assertArray } from './evaluate-json';

export default function dependencySatisfies(path: NodePath<CallExpression>, state: State, packageCache: PackageCache) {
  if (path.node.arguments.length !== 2) {
    throw error(path, `dependencySatisfies takes exactly two arguments, you passed ${path.node.arguments.length}`);
  }
  let [packageName, range] = path.node.arguments;
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
  let sourceFileName = sourceFile(path, state);
  try {
    let us = packageCache.ownerOfFile(sourceFileName);
    if (!us) {
      path.replaceWith(booleanLiteral(false));
      return;
    }
    let version = packageCache.resolve(packageName.value, us).version;
    path.replaceWith(booleanLiteral(satisfies(version, range.value)));
  } catch (err) {
    if (err.code !== 'MODULE_NOT_FOUND') {
      throw err;
    }
    path.replaceWith(booleanLiteral(false));
  }
}
