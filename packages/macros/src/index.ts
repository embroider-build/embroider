import MacrosConfig, { Merger } from "./macros-config";

export function modulePresent(moduleName: string): boolean {
  throw new Oops(moduleName);
}

export function dependencySatisfies(packageName: string, semverRange: string): boolean {
  throw new Oops(packageName, semverRange);
}

export function ifMacro(predicate: boolean, consequent: () => void, alternate: () => void) {
  throw new Oops(predicate, consequent, alternate);
}

export function getConfig<T>(packageName: string): T {
  throw new Oops(packageName);
}

export function getOwnConfig<T>(): T {
  throw new Oops();
}

// Unlike the other methods in this module, this one is intended to be used from
// within your build system, in node.
export function sharedMacrosConfig(): MacrosConfig {
  let g = global as any;
  if (!g.__embroider_macros_global__) {
    g.__embroider_macros_global__ = new MacrosConfig();
  }
  return g.__embroider_macros_global__;
}

export { MacrosConfig, Merger };

class Oops extends Error {
  params: any[];
  constructor(...params: any[]) {
    super(`this method is really implemented at compile time via a babel plugin. If you're seeing this exception, something went wrong`);
    this.params = params;
  }
}
