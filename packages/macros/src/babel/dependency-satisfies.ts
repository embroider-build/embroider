import { NodePath } from '@babel/traverse';
import { booleanLiteral } from '@babel/types';
import State, { sourceFile } from './state';
import { satisfies } from 'semver';
import { PackageCache } from '@embroider/core';

export default function dependencySatisfies(path: NodePath, state: State, packageCache: PackageCache) {
  if (path.parent.type !== 'CallExpression') {
    throw new Error(`You can only use dependencySatisfies as a function call`);
  }
  if (path.parent.arguments.length !== 2) {
    throw new Error(`dependencySatisfies takes exactly two arguments, you passed ${path.parent.arguments.length}`);
  }
  let [packageName, range] = path.parent.arguments;
  if (packageName.type !== 'StringLiteral') {
    throw new Error(`the first argument to dependencySatisfies must be a string literal`);
  }
  if (range.type !== 'StringLiteral') {
    throw new Error(`the second argument to dependencySatisfies must be a string literal`);
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
