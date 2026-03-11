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

export function setTesting(isTesting) {
  if (!runtimeConfig.global) {
    runtimeConfig.global = {};
  }
  if (!runtimeConfig.global['@embroider/macros']) {
    runtimeConfig.global['@embroider/macros'] = {};
  }
  runtimeConfig.global['@embroider/macros'].isTesting = Boolean(isTesting);
}

let runtimeConfig = initializeRuntimeMacrosConfig();

// When Vite dep-optimizes addons, each bundle can get its own copy of this
// module with its own runtimeConfig. We share the entire config via globalThis
// so that:
//   - setTesting()/isTesting() work consistently across all bundles
//   - per-package configs from all bundles are accessible from any copy
//   - global config (including runtime mutations) is unified
//
// This code runs OUTSIDE initializeRuntimeMacrosConfig because the babel plugin
// replaces that function's body with the compiled config literal at transform
// time — any sharing logic inside it would be erased.
//
// Merge strategy when multiple copies exist:
//   - packages: Object.assign into the shared instance. Each package root is a
//     unique key (absolute path), so there are no conflicts.
//   - global: Object.assign into the shared instance. All copies from the same
//     build share the same babel-compiled global config, so values are
//     identical. Runtime mutations (like setTesting) happen after all module
//     copies have initialized, so they safely land on the shared object.
if (typeof globalThis !== 'undefined') {
  let shared = globalThis.__embroider_macros_runtime_config__;
  if (!shared) {
    globalThis.__embroider_macros_runtime_config__ = runtimeConfig;
  } else {
    Object.assign(shared.packages, runtimeConfig.packages);
    Object.assign(shared.global, runtimeConfig.global);
    runtimeConfig = shared;
  }
}

// this exists to be targeted by our babel plugin.
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
