/*
  These are the runtime implementations for the javascript macros that have
  runtime implementations.

  Not every macro has a runtime implementation, some only make sense in the
  build and always run there.

  Even when we have runtime implementations, we are still careful to emit static
  errors during the build wherever possible, and runtime errors when necessary,
  so that you're not surprised when you switch from runtime-mode to compile-time
  mode.
*/

/*
  CAUTION: in classic builds, this file gets shared by all present copies of
  @embroider/macros. If you want to change its public API, you need to rename it
  and update `pathToRuntime` in ../babel/state.ts to point at it, so that your
  babel plugin and runtime will match.
*/

export function each(array) {
  if (!Array.isArray(array)) {
    throw new Error(`the argument to the each() macro must be an array`);
  }
  return array;
}

export function macroCondition(predicate) {
  return predicate;
}

// This is here as a compile target for `getConfig` and `getOwnConfig` when
// we're in runtime mode. This is not public API to call from your own code.
export function config(packageRoot) {
  return runtimeConfig.packages[packageRoot];
}

export function getGlobalConfig() {
  return runtimeConfig.global;
}

export function isTesting() {
  let g = runtimeConfig.global;
  let e = g && g['@embroider/macros'];
  return Boolean(e && e.isTesting);
}

const runtimeConfig = initializeRuntimeMacrosConfig();

// this exists to be targeted by our babel plugin
function initializeRuntimeMacrosConfig() {
  return { packages: {}, global: {} };
}

function updaterMethods() {
  return {
    config,
    getGlobalConfig,
    setConfig(packageRoot, value) {
      runtimeConfig.packages[packageRoot] = value;
    },
    setGlobalConfig(key, value) {
      runtimeConfig.global[key] = value;
    },
  };
}

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
let updaters = typeof window !== 'undefined' ? window._embroider_macros_runtime_config : undefined;
if (updaters) {
  let methods = updaterMethods();
  for (let updater of updaters) {
    updater(methods);
  }
}
