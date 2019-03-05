/* Macro Type Signatures */

// These are the macros you can use from your code. They have these stub
// implementations here so that their types work out correctly. Their real
// implementations are done in babel of course.

export function dependencySatisfies(packageName: string, semverRange: string): boolean {
  throw new Oops(packageName, semverRange);
}

export function macroIf(predicate: boolean, consequent: () => void, alternate: () => void) {
  throw new Oops(predicate, consequent, alternate);
}

export function getConfig<T>(packageName: string): T {
  throw new Oops(packageName);
}

export function getOwnConfig<T>(): T {
  throw new Oops();
}

export function moduleExists(moduleName: string): boolean {
  throw new Oops(moduleName);
}

class Oops extends Error {
  params: any[];
  constructor(...params: any[]) {
    super(`this method is really implemented at compile time via a babel plugin. If you're seeing this exception, something went wrong`);
    this.params = params;
  }
}

// Entrypoint for managing the macro config within Node.
export { default as MacrosConfig, Merger } from "./macros-config";

// Utility for detecting our babel and AST plugins.
import { PluginItem } from "@babel/core";
export function isEmbroiderMacrosPlugin(item: PluginItem) {
  return (
    Array.isArray(item) &&
    item.length > 1 &&
    item[1] &&
    typeof item[1] === 'object' &&
    (item[1] as any).embroiderMacrosConfigMarker
  ) || (
    item &&
    typeof item === 'function' &&
    (item as any).embroiderMacrosASTMarker
  );
}
