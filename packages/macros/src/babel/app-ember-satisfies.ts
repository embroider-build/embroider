import type { NodePath } from '@babel/traverse';
import type { types as t } from '@babel/core';
import type State from './state';
import { satisfies } from 'semver';
import error from './error';
import { assertArray } from './evaluate-json';

const packageName = 'ember-source';

export default function appEmberSatisfies(path: NodePath<t.CallExpression>, state: State): boolean {
  if (path.node.arguments.length !== 1) {
    throw error(path, `appEmberSatisfies takes exactly one argument, you passed ${path.node.arguments.length}`);
  }
  const [range] = path.node.arguments;
  if (range.type !== 'StringLiteral') {
    throw error(
      assertArray(path.get('arguments'))[1],
      `the second argument to dependencySatisfies must be a string literal`
    );
  }
  try {
    let root = state.packageCache.get(state.packageCache.appRoot);

    if (!root?.hasDependency(packageName)) {
      return false;
    }

    let resolvedInfo = state.packageCache.resolve(packageName, root);
    let version = resolvedInfo.version;

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
