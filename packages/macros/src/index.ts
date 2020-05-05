/* Macro Type Signatures */

/*
  CAUTION: this code is not necessarily what you are actually running. In
  general, the macros are implemented at build time using babel, and so calls to
  these functions get compiled away before they ever run. However, this code is
  here because it provides types to typescript users of the macros.

  Some macros also have runtime implementations that are useful in development
  mode, in addition to their build-time implementations in babel. You can find
  the runtime implementations in ./runtime.ts.

  Having a runtime mode lets us do things like produce a single build in
  development that works for both fastboot and browser, using the macros to
  switch between modes. For production, you would switch to the build-time macro
  implementation to get two optimized builds instead.
*/

export function dependencySatisfies(packageName: string, semverRange: string): boolean {
  throw new Oops(packageName, semverRange);
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

// TODO: beyond this point should only ever be used within the build system. We
// need to guard it so it never ships in apps.

// Entrypoint for managing the macro config within Node.
export { default as MacrosConfig, Merger } from './macros-config';

// Utility for detecting our babel and AST plugins.
import { PluginItem } from '@babel/core';
export function isEmbroiderMacrosPlugin(item: PluginItem) {
  return (
    (Array.isArray(item) &&
      item.length > 1 &&
      item[1] &&
      typeof item[1] === 'object' &&
      (item[1] as any).embroiderMacrosConfigMarker) ||
    (item && typeof item === 'function' && (item as any).embroiderMacrosASTMarker)
  );
}
