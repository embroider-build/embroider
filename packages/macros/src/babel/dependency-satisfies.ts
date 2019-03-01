import { NodePath } from '@babel/traverse';
import { booleanLiteral } from '@babel/types';
import State, { sourceFile } from './state';
import { satisfies } from 'semver';
import { PackageCache } from '@embroider/core';
import error from './error';
import { assertArray } from './evaluate-json';

export default function dependencySatisfies(path: NodePath, state: State, packageCache: PackageCache) {
  if (path.parent.type !== 'CallExpression') {
    throw error(path, `You can only use dependencySatisfies as a function call`);
  }
  if (path.parent.arguments.length !== 2) {
    throw error(path.parentPath, `dependencySatisfies takes exactly two arguments, you passed ${path.parent.arguments.length}`);
  }
  let [packageName, range] = path.parent.arguments;
  if (packageName.type !== 'StringLiteral') {
    throw error(assertArray(path.parentPath.get('arguments'))[0], `the first argument to dependencySatisfies must be a string literal`);
  }
  if (range.type !== 'StringLiteral') {
    throw error(assertArray(path.parentPath.get('arguments'))[1], `the second argument to dependencySatisfies must be a string literal`);
  }
  let sourceFileName = sourceFile(path, state);
  try {
    let us = packageCache.ownerOfFile(sourceFileName);
    if (!us) {
      path.parentPath.replaceWith(booleanLiteral(false));
      state.removed.push(path.parentPath);
      return;
    }
    let version = packageCache.resolve(packageName.value, us).version;
    path.parentPath.replaceWith(booleanLiteral(satisfies(version, range.value)));
  } catch (err) {
    path.parentPath.replaceWith(booleanLiteral(false));
  }
  state.removed.push(path.parentPath);
}
