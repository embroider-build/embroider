import { tmpdir } from '@embroider/shared-internals';
import { cloneDeep } from 'lodash';
import { join } from 'path';

// This is a collection of flags that convey what kind of build you want. They
// are intended to be generic across Packagers, and it's up to Packager authors
// to support each option (or not).
export interface Variant {
  // descriptive name that can be used by the packager to label which output
  // goes with which variant.
  name: string;

  // Which runtime should this build work in? Dev builds will typically be "all"
  // because we produce a single build that works in browser and fastboot. But
  // production builds can be divided into a browser-only variant and a
  // fastboot-only variant so that each can be separately optimized.
  //
  // Note that if you build *only* a fastboot variant, you're unlikely to end up
  // with any assets that can boot and run in the browser too, so the typical
  // thing to do is to have to two variants and for the packager to use the
  // assets from the browser build to generate browser-facing <script> tags in
  // the output of the fastboot build.
  runtime: 'all' | 'browser' | 'fastboot';

  // true if this build should be optimized for production, at the cost of
  // slower builds and/or worse debuggability
  optimizeForProduction: boolean;
}

export interface PackagerConstructor<Options> {
  new (
    // where on disk the packager will find the app it's supposed to build. The
    // app and its addons will necessarily already be in v2 format, which is
    // what makes a Packager a cleanly separable stage that needs only a small
    // amount of ember-specific knowledge.
    inputPath: string,
    // where the packager should write the packaged app.
    outputPath: string,
    // list of active build variants. There is always at least one variant, but
    // there can be many.
    //
    // The main requirement for correctness is that the Packager is required to
    // apply each variant to the babel and template-compiler configs that it
    // finds in the app in order to build that variant.
    //
    // It is up to each Packager to decide how to combine the output from the
    // multiple variants. It might choose to just put them in separate
    // subdirectories of `outputPath`, or it might know how to combine them
    // correctly into one build that will run each variant under the appropriate
    // conditions.
    //
    // Not all packagers will support all arbitrary combinations of variants.
    variants: Variant[],
    // if possible, the packager should direct its console output through this
    // hook.
    consoleWrite: (message: string) => void,
    // A packager can have whatever custom options type it wants here. If the
    // packager is based on a third-party tool, this is where that tool's
    // configuration can go.
    options?: Options
  ): Packager;

  // a description for this packager that aids debugging & profiling
  annotation: string;
}

export interface Packager {
  build(): Promise<void>;
}

export function applyVariantToBabelConfig(variant: Variant, babelConfig: any) {
  if (variant.runtime === 'fastboot') {
    babelConfig = Object.assign({}, babelConfig);
    if (babelConfig.plugins) {
      babelConfig.plugins = babelConfig.plugins.slice();
    } else {
      babelConfig.plugins = [];
    }
    let macroPlugin = babelConfig.plugins.find(
      (p: any) => Array.isArray(p) && p[1] && p[1].embroiderMacrosConfigMarker
    );
    if (macroPlugin) {
      let modifiedMacroPlugin = cloneDeep(macroPlugin);
      modifiedMacroPlugin[1].globalConfig.fastboot = { isRunning: true };
      babelConfig.plugins.splice(babelConfig.plugins.indexOf(macroPlugin), 1, modifiedMacroPlugin);
    }
  }
  return babelConfig;
}

/**
 * Get the path to a cache directory in the recommended location
 *
 * This ensures they have exactly the same lifetime as some of embroider's own caches.
 */
export function getPackagerCacheDir(name: string): string {
  return join(tmpdir, 'embroider', name);
}
