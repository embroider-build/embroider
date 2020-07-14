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

export function getGlobalConfig(): unknown {
  return runtimeConfig.global;
}

export function isTesting(): boolean {
  let g = runtimeConfig.global as any;
  let e = g && g['@embroider/macros'];
  return Boolean(e && e.isTesting);
}

export function isDeveloping(): boolean {
  let g = runtimeConfig.global as any;
  let e = g && g['@embroider/macros'];
  return Boolean(e && e.isDeveloping);
}

const runtimeConfig: {
  packages: { [packageRoot: string]: unknown };
  global: { [key: string]: unknown };
} = initializeRuntimeMacrosConfig();

// this exists to be targeted by our babel plugin
function initializeRuntimeMacrosConfig() {
  return { packages: {}, global: {} };
}

function updaterMethods() {
  return {
    config,
    getGlobalConfig,
    setConfig(packageRoot: string, value: unknown) {
      runtimeConfig.packages[packageRoot] = value;
    },
    setGlobalConfig(key: string, value: unknown) {
      runtimeConfig.global[key] = value;
    },
  };
}

type Updater = (methods: ReturnType<typeof updaterMethods>) => void;

// this is how runtime config can get injected at boot. I'm not sure yet if this
// should be public API, but we certainly need it internally to set things like
// the global fastboot.isRunning.
//
// consumers of this API push a function onto
// window._embroider_macros_runtime_config. The function is given four methods
// which allow it to read and write the per-package and global configs. The
// reason for allowing both read & write is that merging strategies are up to
// each consumers -- read first, then merge, then write.
//
// For an example user of this API, see where we generate
// embroider_macros_fastboot_init.js' in @embroider/core.
let updaters: Updater[] | undefined =
  typeof window !== 'undefined' ? (window as any)._embroider_macros_runtime_config : undefined;
if (updaters) {
  let methods = updaterMethods();
  for (let updater of updaters) {
    updater(methods);
  }
}
