/* Macro Type Signatures */

/*
  CAUTION: this code is not necessarily what you are actually running. In
  general, the macros are implemented at build time using babel, and so calls to
  these functions get compiled away before they ever run. However, this code is
  here because it provides types to typescript users of the macros.

  Some macros also have runtime implementations that are useful in development
  mode, in addition to their build-time implementations in babel. You can find
  the runtime implementations in runtime.ts.

  Having a runtime mode lets us do things like produce a single build in
  development that works for both fastboot and browser, using the macros to
  switch between modes. For production, you would switch to the build-time macro
  implementation to get two optimized builds instead.
*/

export function dependencySatisfies(packageName: string, semverRange: string): boolean {
  throw new Oops(packageName, semverRange);
}

export function appEmberSatisfies(semverRange: string): boolean {
  throw new Oops(semverRange);
}

export function macroCondition(predicate: boolean): boolean {
  throw new Oops(predicate);
}

export function each<T>(array: T[]): T[] {
  throw new Oops(array);
}

// We would prefer to write:
//   export function importSync<T extends string>(specifier: T): typeof import(T) {
// but TS doesn't seem to support that at present.
export function importSync(specifier: string): unknown {
  throw new Oops(specifier);
}

export function getConfig<T>(packageName: string): T {
  throw new Oops(packageName);
}

export function getOwnConfig<T>(): T {
  throw new Oops();
}

export function getGlobalConfig<T>(): T {
  throw new Oops();
}

export function isDevelopingApp(): boolean {
  throw new Oops();
}

export function isTesting(): boolean {
  throw new Oops();
}

export function setTesting(): boolean {
  throw new Oops();
}

export function failBuild(message: string): void {
  throw new Oops(message);
}

export function moduleExists(packageName: string): boolean {
  throw new Oops(packageName);
}

class Oops extends Error {
  params: any[];
  constructor(...params: any[]) {
    super(
      `this method is really implemented at compile time via a babel plugin. If you're seeing this exception, something went wrong`
    );
    this.params = params;
  }
}

import type { HelperLike } from '@glint/template';

export interface EmbroiderMacrosRegistry {
  macroGetOwnConfig: HelperLike<{
    Args: { Positional: [...keys: string[]] };
    Return: ReturnType<typeof getOwnConfig>;
  }>;
  macroGetConfig: HelperLike<{
    Args: { Positional: [packageName: string, ...keys: string[]] };
    Return: ReturnType<typeof getConfig>;
  }>;
  macroCondition: HelperLike<{
    Args: { Positional: [predicate: boolean] };
    Return: boolean;
  }>;
  macroDependencySatisfies: HelperLike<{
    Args: { Positional: Parameters<typeof dependencySatisfies> };
    Return: ReturnType<typeof dependencySatisfies>;
  }>;
  macroAppEmberSatisfies: HelperLike<{
    Args: { Positional: Parameters<typeof appEmberSatisfies> };
    Return: ReturnType<typeof appEmberSatisfies>;
  }>;
  macroMaybeAttrs: HelperLike<{
    Args: { Positional: [predicate: boolean, ...bareAttrs: unknown[]] };
    Return: void;
  }>;
  macroFailBuild: HelperLike<{
    Args: { Positional: Parameters<typeof failBuild> };
    Return: ReturnType<typeof failBuild>;
  }>;
}
