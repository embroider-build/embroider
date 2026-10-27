import { lilconfigSync, type LoaderSync } from 'lilconfig';
import { basename } from 'path';
import type { Options as ResolverOptions } from './module-resolver-options';

export interface LoadedEmbroiderConfig {
  filepath: string;
  config: Record<string, unknown>;
}

/**
 * Node can `require()` ES modules since 20.19,
 * so a sync loader can read an ESM `.js` file in a `"type": "module"` app.
 */
const loadModule: LoaderSync = filepath => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  let mod = require(filepath);
  if (mod?.[Symbol.toStringTag] === 'Module') {
    return mod.default;
  }
  return mod;
};

/**
 * Finds the Embroider config of an app.
 *
 * Only the app root is searched, not its parent directories.
 * In `package.json`, the config is the `"embroider"` key.
 */
export function loadEmbroiderConfig(appRoot: string): LoadedEmbroiderConfig | undefined {
  let result = lilconfigSync('embroider', {
    stopDir: appRoot,
    loaders: { '.js': loadModule, '.cjs': loadModule },
  }).search(appRoot);

  if (!result) {
    return undefined;
  }

  let { filepath, config } = result;
  if (typeof config !== 'object' || config === null || Array.isArray(config)) {
    throw new Error(`The Embroider config in ${filepath} must be an object of options.`);
  }
  return { filepath, config };
}

/**
 * Merges the config file with the options that ember-cli-build gives to `compatBuild`.
 *
 * The config file is the source of truth.
 * The ember-cli-build options stay for compatibility,
 * and this is the one place that sees which options come from there.
 */
export function withEmbroiderConfig<T extends object>(appRoot: string, options: T | undefined): T | undefined {
  let loaded = loadEmbroiderConfig(appRoot);
  if (!loaded) {
    return options;
  }

  let merged: Record<string, unknown> = Object.assign({}, loaded.config);
  let duplicates: string[] = [];
  for (let [key, value] of Object.entries(options ?? {})) {
    if (value === undefined) {
      continue;
    }
    if (key in loaded.config) {
      duplicates.push(key);
    }
    merged[key] = value;
  }

  if (duplicates.length > 0) {
    throw new Error(
      `These Embroider options are set in ember-cli-build and in ${basename(loaded.filepath)}: ${duplicates.join(
        ', '
      )}. Set each option in one place only.`
    );
  }
  return merged as T;
}

/**
 * The user options that the resolver reads during the build.
 * Without a prebuild, nothing reads the other options of `compatBuild`.
 */
const minimalAppKeys = ['splitAtRoutes', 'staticAppPaths'];

/**
 * Puts the user options of the config file over the resolver options.
 *
 * `prebuilt` is true when the options come from the `resolver.json` of the prebuild.
 * That file holds the ember-cli-build options too, so the config file wins.
 */
export function withUserConfig<T extends ResolverOptions>(appRoot: string, resolverOptions: T, prebuilt: boolean): T {
  let loaded = loadEmbroiderConfig(appRoot);
  if (!loaded) {
    return resolverOptions;
  }
  let config = loaded.config;

  if (!prebuilt) {
    let unexpected = Object.keys(config).filter(key => !minimalAppKeys.includes(key));
    if (unexpected.length > 0) {
      throw new Error(
        `Unexpected properties in ${basename(loaded.filepath)}: ${unexpected.join(', ')}. ` +
          `Expected only: ${minimalAppKeys.join(', ')}.`
      );
    }
  }

  let result: T = Object.assign({}, resolverOptions);
  if ('splitAtRoutes' in config) {
    result.splitAtRoutes = config.splitAtRoutes as T['splitAtRoutes'];
  }
  if ('staticAppPaths' in config) {
    result.staticAppPaths = config.staticAppPaths as T['staticAppPaths'];
  }
  if (result.options) {
    result.options = Object.assign({}, result.options);
    if ('staticInvokables' in config) {
      result.options.staticInvokables = config.staticInvokables as boolean;
    }
    if ('allowUnsafeDynamicComponents' in config) {
      result.options.allowUnsafeDynamicComponents = config.allowUnsafeDynamicComponents as boolean;
    }
  }
  return result;
}
