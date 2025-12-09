import type { NodePath } from '@babel/traverse';
import type { types as t } from '@babel/core';
import type State from './state';
import { satisfies } from 'semver';
import error from './error';
import { assertArray } from './evaluate-json';

const CACHE = new Map<string, string | false>();

function getAppEmberVersion(state: State): string | false {
  let appRoot = state.packageCache.appRoot;
  const DUMMY_APP_PATH = '/tests/dummy';
  if (appRoot.endsWith(DUMMY_APP_PATH)) {
    appRoot = appRoot.slice(0, -DUMMY_APP_PATH.length);
  }
  if (CACHE.has(appRoot)) {
    return CACHE.get(appRoot)!;
  }

  let app = state.packageCache.get(appRoot);
  let version: string | false = app.dependencies.find(d => d.name === 'ember-source')?.version ?? false;
  CACHE.set(appRoot, version);
  return version;
}

export default function appEmberSatisfies(path: NodePath<t.CallExpression>, state: State): boolean {
  if (path.node.arguments.length !== 1) {
    throw error(path, `appEmberSatisfies takes exactly one argument, you passed ${path.node.arguments.length}`);
  }
  const [range] = path.node.arguments;
  if (range.type !== 'StringLiteral') {
    throw error(
      assertArray(path.get('arguments'))[0],
      `the only argument to appEmberSatisfies must be a string literal`
    );
  }

  let appEmberVersion = getAppEmberVersion(state);

  if (!appEmberVersion) {
    return false;
  }

  return satisfies(appEmberVersion, range.value, {
    includePrerelease: true,
  });
}
