import { esBuildResolver } from './esbuild-resolver.js';

export interface OptimizeDeps {
  [key: string]: unknown;
}

export function optimizeDeps(): OptimizeDeps {
  return {
    // Ensure @embroider/macros/src/addon/runtime is always pre-bundled so that
    // all imports (from the app and from v2 addons) resolve to the same single
    // module instance. Without this, the @embroider/macros babel plugin rewrites
    // imports to relative file paths before the dep scanner records them as bare
    // package imports, which can leave runtime.js un-pre-bundled and result in
    // duplicate instances when a v2 addon from a separate repo is consumed. See
    // https://github.com/embroider-build/embroider/issues/2660
    include: ['@embroider/macros/src/addon/runtime'],
    extensions: ['.hbs', '.gjs', '.gts'],
    esbuildOptions: {
      plugins: [esBuildResolver()],
    },
  };
}
