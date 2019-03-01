import MacrosConfig, { Merger } from "./macros-config";

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

export { MacrosConfig, Merger };

class Oops extends Error {
  params: any[];
  constructor(...params: any[]) {
    super(`this method is really implemented at compile time via a babel plugin. If you're seeing this exception, something went wrong`);
    this.params = params;
  }
}
