import { join } from "path";
import { PluginItem } from "@babel/core";

export function modulePresent(moduleName: string): boolean {
  throw new Oops(moduleName);
}

export function dependencySatisfies(packageName: string, semverRange: string): boolean {
  throw new Oops(packageName, semverRange);
}

export function ifMacro(predicate: boolean, consequent: () => void, alternate: () => void) {
  throw new Oops(predicate, consequent, alternate);
}

// To be used from within your build system. Your config type (T) must be
// json-serializable. If you provide a merger, it is used to reconcile the
// results from multiple independent setConfigs that all targeted this same
// package.
//
// You must always set fromPath to `__filename`.
export function setConfig<T>(fromPath: string, packageName: string, config: () => T, merger?: Merger<T>) {

}

// Macros for accessing the value that was passed to setConfig.
export function getConfig<T>(packageName: string): T {
  throw new Oops(packageName);
}

// to be called from within your build system. Returns the thing you should push
// into your babel plugins list.
export function babelPluginConfig(): PluginItem {
  return [join(__dirname, 'macros-babel-plugin.js'), {}];
}

type Merger<T> = (configs: T[]) => T;

class Oops extends Error {
  params: any[];
  constructor(...params: any[]) {
    super(`this method is really implemented at compile time via a babel plugin. If you're seeing this exception, something went wrong`);
    this.params = params;
  }
}
