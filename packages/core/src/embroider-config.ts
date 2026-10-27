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

function lookup(config: Record<string, unknown>, path: string): { found: boolean; value: unknown } {
  let cursor: unknown = config;
  for (let key of path.split('.')) {
    if (typeof cursor !== 'object' || cursor === null || !(key in cursor)) {
      return { found: false, value: undefined };
    }
    cursor = (cursor as Record<string, unknown>)[key];
  }
  return { found: true, value: cursor };
}

/**
 * True when the Embroider config file of the app sets the option.
 * `path` can name a nested option, for example `amdCompatibility.es`.
 */
export function hasSpecifiedInEmbroiderConfig(appRoot: string, path: string): boolean {
  let loaded = loadEmbroiderConfig(appRoot);
  return loaded ? lookup(loaded.config, path).found : false;
}

export function getFromEmbroiderConfig(appRoot: string, path: string): unknown {
  let loaded = loadEmbroiderConfig(appRoot);
  return loaded ? lookup(loaded.config, path).value : undefined;
}

const deprecated = new Set<string>();

/**
 * Tells the user to move an option from its old place to the Embroider config file.
 * Each option shows the message once per process.
 */
export function deprecateOldConfig(appRoot: string, path: string, oldPlace: string): void {
  let key = `${appRoot}\0${path}\0${oldPlace}`;
  if (deprecated.has(key)) {
    return;
  }
  deprecated.add(key);
  let file = basename(loadEmbroiderConfig(appRoot)?.filepath ?? 'the Embroider config file');
  console.warn(
    `DEPRECATION: The Embroider option "${path}" is set in ${oldPlace} and in ${file}. ` +
      `Embroider uses the value from ${file}. Remove "${path}" from ${oldPlace}.`
  );
}

/**
 * The user options that the resolver reads during the build.
 * Without a prebuild, nothing reads the other options of `compatBuild`.
 */
const minimalAppKeys = ['splitAtRoutes', 'staticAppPaths'];

/**
 * Reads the user options of the resolver.
 *
 * `prebuilt` is true when the options come from the `resolver.json` of the prebuild.
 * Users do not edit that file, so it is not an old place to deprecate.
 */
export function withUserConfig<T extends ResolverOptions>(appRoot: string, resolverOptions: T, prebuilt: boolean): T {
  let loaded = loadEmbroiderConfig(appRoot);
  if (!loaded) {
    return resolverOptions;
  }

  if (!prebuilt) {
    let unexpected = Object.keys(loaded.config).filter(key => !minimalAppKeys.includes(key));
    if (unexpected.length > 0) {
      throw new Error(
        `Unexpected properties in ${basename(loaded.filepath)}: ${unexpected.join(', ')}. ` +
          `Expected only: ${minimalAppKeys.join(', ')}.`
      );
    }
  }

  let result: T = Object.assign({}, resolverOptions);
  if (hasSpecifiedInEmbroiderConfig(appRoot, 'splitAtRoutes')) {
    result.splitAtRoutes = getFromEmbroiderConfig(appRoot, 'splitAtRoutes') as T['splitAtRoutes'];
  }
  if (hasSpecifiedInEmbroiderConfig(appRoot, 'staticAppPaths')) {
    result.staticAppPaths = getFromEmbroiderConfig(appRoot, 'staticAppPaths') as T['staticAppPaths'];
  }
  if (result.options) {
    result.options = Object.assign({}, result.options);
    if (hasSpecifiedInEmbroiderConfig(appRoot, 'staticInvokables')) {
      result.options.staticInvokables = getFromEmbroiderConfig(appRoot, 'staticInvokables') as boolean;
    }
    if (hasSpecifiedInEmbroiderConfig(appRoot, 'allowUnsafeDynamicComponents')) {
      result.options.allowUnsafeDynamicComponents = getFromEmbroiderConfig(
        appRoot,
        'allowUnsafeDynamicComponents'
      ) as boolean;
    }
  }
  return result;
}
