import resolve from 'resolve';
import { dirname } from 'path';
import { NodePath } from '@babel/traverse';
import { booleanLiteral } from '@babel/types';
import State from './state';
import { readJSONSync } from 'fs-extra';
import { satisfies } from 'semver';

export default function dependencySatisfies(path: NodePath, state: State) {
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
  let sourceFileName = path.hub.file.opts.filename;
  try {
    let pkg = resolve.sync(packageName.value + '/package.json', { basedir: dirname(sourceFileName) });
    let version = readJSONSync(pkg).version;
    path.parentPath.replaceWith(booleanLiteral(satisfies(version, range.value)));
  } catch (err) {
    path.parentPath.replaceWith(booleanLiteral(false));
  }
  state.removed.push(path.parentPath);
}
