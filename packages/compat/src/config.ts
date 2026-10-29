import type Options from './options';
import type { CompatOptionsType } from './options';
import { optionsWithDefaults } from './options';
import { loadEmbroiderConfig } from '@embroider/core/src/config-loader';
import { defineConfig as defineCoreConfig } from '@embroider/core/src/config';

// Use this in your embroider.conf.mjs (or .mts, .cjs, .cts, .js, .ts) to get
// types for your config:
//
//   import { defineConfig } from '@embroider/compat/config';
//   export default defineConfig({ staticInvokables: true });
//
// Compat's options are a superset of core's.
//
// This module deliberately avoids loading the build system, so that evaluating
// your config file stays cheap.
export function defineConfig<T extends Options>(config: T): T {
  return defineCoreConfig(config);
}

// Loads the config for the app at appRoot and throws if it's invalid. This
// covers both compat's and core's options. It doesn't populate the config
// cache, so it's safe to call early.
export function validateConfig(appRoot: string): CompatOptionsType {
  return optionsWithDefaults(loadEmbroiderConfig(appRoot, { cache: false }).options as Options);
}
