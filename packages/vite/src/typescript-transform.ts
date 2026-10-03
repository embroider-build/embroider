import type { Plugin } from 'vite';

/**
 * Turns Vite's own TypeScript transform off, unless the app configured it:
 * TypeScript is compiled by babel, because we don't want esbuild's or oxc's
 * decorator implementation (`@tracked` in a `.ts` file would stop working).
 *
 * This runs before other plugins' `config` hooks (`order: 'pre'`): Vitest's
 * own config hook sets a `target` on `oxc` (`esbuild` before Vite 8), after
 * which an unset value can no longer tell us whether the app configured it.
 */
export function typescriptTransform(): Plugin {
  return {
    name: 'embroider-typescript-transform',
    config: {
      order: 'pre',
      handler(config) {
        if (this?.meta?.rolldownVersion) {
          if (config.oxc == null) {
            config.oxc = false;
          }
        } else if (config.esbuild == null) {
          config.esbuild = false;
        }
      },
    },
  };
}
