import { lilconfigSync, type LoaderSync } from 'lilconfig';
import { basename } from 'path';

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
 * Embroider reads the config file here only when `compatBuild` did not write a `resolver.json`.
 * Apps with `ember-cli-build` give the config to `compatBuild` instead.
 */
const resolverConfigKeys = ['splitAtRoutes', 'staticAppPaths'];

export function resolverOptionsFromEmbroiderConfig(appRoot: string): {
  splitAtRoutes?: (RegExp | string)[];
  staticAppPaths?: string[];
} {
  let loaded = loadEmbroiderConfig(appRoot);
  if (!loaded) {
    return {};
  }

  let unexpected = Object.keys(loaded.config).filter(key => !resolverConfigKeys.includes(key));
  if (unexpected.length > 0) {
    throw new Error(
      `Unexpected properties in ${basename(loaded.filepath)}: ${unexpected.join(', ')}. ` +
        `Expected only: ${resolverConfigKeys.join(', ')}.`
    );
  }
  return loaded.config;
}
