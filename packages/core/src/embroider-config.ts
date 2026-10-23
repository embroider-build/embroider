import { lilconfigSync, type LoaderSync } from 'lilconfig';
import { basename } from 'path';

export interface LoadedEmbroiderConfig {
  filepath: string;
  config: Record<string, unknown>;
}

const searchPlaces = [
  'package.json',
  '.embroiderrc.json',
  'embroider.config.js',
  'embroider.config.mjs',
  'embroider.config.cjs',
];

/**
 * Node can `require()` ES modules since 20.19,
 * so one sync loader covers `.js`, `.mjs`, and `.cjs` files.
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
    searchPlaces,
    stopDir: appRoot,
    loaders: { '.js': loadModule, '.mjs': loadModule, '.cjs': loadModule },
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
 * The options that apps without an `ember-cli-build` file can set.
 * Apps with one can set every option of `compatBuild`.
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

  for (let key of Object.keys(loaded.config)) {
    if (!resolverConfigKeys.includes(key)) {
      throw new Error(
        `${basename(loaded.filepath)} sets the Embroider option "${key}". ` +
          `Apps without an ember-cli-build file can set only these options: ${resolverConfigKeys.join(', ')}.`
      );
    }
  }
  return loaded.config;
}
