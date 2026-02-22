/*
  This is the node-specific runtime implementation for @embroider/macros.

  When running in Node.js (as opposed to the browser), we actually answer
  the questions each macro is meant to answer rather than throwing errors.
  This is used for things like running tests in Node, server-side rendering,
  or any other non-browser context.
*/

import { satisfies } from 'semver';
import resolve from 'resolve';
import { join } from 'path';
import { readFileSync } from 'fs';
import { createRequire } from 'module';

const nodeRequire = createRequire(__filename);

export function dependencySatisfies(packageName: string, semverRange: string): boolean {
  // NOTE: Unlike the babel implementation, which knows the exact source file location and
  // can resolve relative to the owning package, this node runtime can only resolve from
  // the current working directory. This means it may find a different version of a package
  // than what the actual caller's package has as a dependency, if the project has multiple
  // nested copies of the same package.
  try {
    let packageJsonPath = resolve.sync(join(packageName, 'package.json'), { basedir: process.cwd() });
    let pkg = JSON.parse(readFileSync(packageJsonPath, 'utf-8')) as { version: string };
    return satisfies(pkg.version, semverRange, { includePrerelease: true });
  } catch (err: any) {
    if (err.code === 'MODULE_NOT_FOUND') {
      return false;
    }
    throw err;
  }
}

// NOTE: Unlike the babel implementation which knows the app root, this node runtime resolves
// ember-source from the current working directory (CWD), which may not be the app root.
export function appEmberSatisfies(semverRange: string): boolean {
  return dependencySatisfies('ember-source', semverRange);
}

export function macroCondition(predicate: boolean): boolean {
  return predicate;
}

export function each<T>(array: T[]): T[] {
  if (!Array.isArray(array)) {
    throw new Error(`the argument to the each() macro must be an array`);
  }
  return array;
}

// NOTE: This uses createRequire which will only work in versions of Node.js that support
// require() of ES modules (Node 22+ with --experimental-require-module, or Node 23.3+ where
// it is unflagged). In older Node.js versions, requiring an ESM module will throw an error.
export function importSync(specifier: string): unknown {
  return nodeRequire(specifier);
}

export function getConfig<T>(_packageName: string): T | undefined {
  return undefined;
}

export function getOwnConfig<T>(): T | undefined {
  return undefined;
}

export function getGlobalConfig<T>(): T {
  return {} as T;
}

export function isDevelopingApp(): boolean {
  return process.env['EMBER_ENV'] !== 'production';
}

export function isTesting(): boolean {
  return process.env['EMBER_ENV'] === 'test';
}

export function failBuild(message: string, ...params: unknown[]): never {
  let index = 0;
  throw new Error(message.replace(/%s/g, () => String(params[index++])));
}

export function moduleExists(packageName: string): boolean {
  try {
    resolve.sync(packageName, { basedir: process.cwd() });
    return true;
  } catch (err: any) {
    if (err.code === 'MODULE_NOT_FOUND') {
      return false;
    }
    throw err;
  }
}
