/*
  These are the runtime implementations for the javascript macros that have
  runtime implementations.

  Not every macro has a runtime implementations, some only make sense in the
  build and always run there.

  Even when we have runtime implementations, we are still careful to emit static
  errors during the build wherever possible, and runtime errors when necessary,
  so that you're not surprised when you switch from runtime-mode to compile-time
  mode.
*/

export function each<T>(array: T[]): T[] {
  if (!Array.isArray(array)) {
    throw new Error(`the argument to the each() macro must be an array`);
  }
  return array;
}

export function macroCondition(predicate: boolean): boolean {
  return predicate;
}

// This is here as a compile target for `getConfig` and `getOwnConfig` when
// we're in runtime mode. This is not public API to call from your own code.
export function config<T>(packageRoot: string): T | undefined {
  return runtimeConfig.packages[packageRoot] as T;
}

export function globalConfig(): unknown {
  return runtimeConfig.global;
}

const runtimeConfig: {
  packages: { [packageRoot: string]: unknown };
  global: { [key: string]: unknown };
} = initializeRuntimeMacrosConfig();

// this exists to be targeted by our babel plugin
function initializeRuntimeMacrosConfig() {
  return { packages: {}, global: {} };
}
