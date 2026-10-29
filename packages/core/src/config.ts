import type Options from './options';
import type { CoreOptionsType } from './options';
import { optionsWithDefaults } from './options';
import { loadEmbroiderConfig } from './config-loader';

// Use this in your embroider.conf.mjs (or .mts, .cjs, .cts, .js, .ts) to get
// types for your config:
//
//   import { defineConfig } from '@embroider/core/config';
//   export default defineConfig({ splitAtRoutes: ['admin'] });
//
// Apps using @embroider/compat should use the one from
// '@embroider/compat/config' instead, which knows about the compat options.
//
// This module deliberately avoids loading the build system, so that evaluating
// your config file stays cheap.
export function defineConfig<T extends Options>(config: T): T {
  return config;
}

// Loads the config for the app at appRoot and throws if it's invalid. This
// doesn't populate the config cache, so it's safe to call early.
export function validateConfig(appRoot: string): CoreOptionsType {
  return optionsWithDefaults(loadEmbroiderConfig(appRoot, { cache: false }).options as Options);
}
