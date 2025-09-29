import type { NodePath } from '@babel/traverse';
import type { types as t } from '@babel/core';
import type State from './state';
import { satisfies, coerce } from 'semver';
import error from './error';
import { assertArray } from './evaluate-json';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { dirname } from 'node:path';
import findUp from 'find-up';

const packageName = 'ember-source';
const CACHE = new Map<string, string | false>();
/**
 * NOTE: Since there will only ever be one app ember version, we can cache the result of looking it up.
 *       (partly to save disk i/o)
 */
function getAppEmberVersion(state: State): string | false {
  let appRoot = state.packageCache.appRoot;

  if (CACHE.has(appRoot)) {
    return CACHE.get(appRoot)!;
  }

  let root = state.packageCache.get(appRoot);

  if (!root?.hasDependency(packageName)) {
    CACHE.set(appRoot, false);
    return false;
  }

  /**
   * This version can, and often is a range (^6.4.0),
   * and using a range for the first parameter of satisfies will cause a failure to always occur.
   * So we must resolve the actual version on disk.
   */
  let resolvedInfo = state.packageCache.resolve(packageName, root);
  let version = resolvedInfo.version;
  /**
   * But, if the version is "clean", we can avoid a disk hit
   * (which is helpful for corporate machines which intercept every disk i/o behavior)
   */
  let cleanedVersion = String(coerce(version, { includePrerelease: true }));

  /**
   * these are the same, so we don't need to ask the disk what was installed
   */
  if (cleanedVersion === version) {
    CACHE.set(appRoot, version);
    return version;
  }

  const appURL = pathToFileURL(appRoot);
  const require = createRequire(appURL);
  const emberSourceEntry = require.resolve(packageName, {
    paths: [appRoot],
  });
  const emberSourceManifestPath = findUp.sync('package.json', { cwd: dirname(emberSourceEntry) });

  if (!emberSourceManifestPath) {
    throw new Error(`We resolved an ember-source package, but could not find its package.json`);
  }
  const emberSourceManifest = require(emberSourceManifestPath);

  CACHE.set(appRoot, emberSourceManifest.version);
  return emberSourceManifest.version;
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
  try {
    let appEmberVersion = getAppEmberVersion(state);

    if (!appEmberVersion) {
      return false;
    }

    return satisfies(appEmberVersion, range.value, {
      includePrerelease: true,
    });
  } catch (err) {
    if (err.code !== 'MODULE_NOT_FOUND') {
      throw err;
    }
    return false;
  }
}
