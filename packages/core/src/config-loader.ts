import { existsSync, readJSONSync } from 'fs-extra';
import { dirname, join, resolve } from 'path';
import { locateEmbroiderWorkingDir } from '@embroider/shared-internals/src/working-dir';
import type Options from './options';
import { optionsWithDefaults, type CoreOptionsType } from './options';

export const configFileNames = ['mjs', 'mts', 'cjs', 'cts', 'js', 'ts'].map(ext => `embroider.conf.${ext}`);

export interface LoadedConfig {
  // 'file': from embroider.conf.*
  // 'ember-cli-build': from the deprecated ember-cli-build.js options
  // 'none': no user config, everything is defaults
  source: 'file' | 'ember-cli-build' | 'none';
  filename?: string;
  // The raw user-provided options. Each consumer applies its own defaults (see
  // coreOptions() and compat's compatOptions()) because core doesn't know
  // about all the options.
  options: Record<string, unknown>;
}

const cache = new Map<string, LoadedConfig>();

// The config file lives next to the app's package.json. For classic dummy
// apps, appRoot is tests/dummy and this walks up to the addon.
export function locateProjectRoot(appRoot: string): string {
  let dir = resolve(appRoot);
  while (!existsSync(join(dir, 'package.json'))) {
    let parent = dirname(dir);
    if (parent === dir) {
      throw new Error(`unable to find a package.json at or above ${appRoot}`);
    }
    dir = parent;
  }
  return dir;
}

export function locateConfigFile(appRoot: string): string | undefined {
  let projectRoot = locateProjectRoot(appRoot);
  let found = configFileNames.map(name => join(projectRoot, name)).filter(f => existsSync(f));
  if (found.length > 1) {
    throw new Error(`Found more than one embroider config file, please keep only one: ${found.join(', ')}`);
  }
  return found[0];
}

// Returns the user's embroider options for the app at appRoot. Results are
// cached per project root. Use clearEmbroiderConfigCache to force a re-read.
//
// Pass `{ cache: false }` to avoid populating the cache. That's for early
// validation, which can happen before the prebuild has written the deprecated
// ember-cli-build.js options into resolver.json.
export function loadEmbroiderConfig(appRoot: string, opts: { cache?: boolean } = {}): LoadedConfig {
  let projectRoot = locateProjectRoot(appRoot);
  let loaded = cache.get(projectRoot);
  if (!loaded) {
    loaded = readConfigFile(projectRoot) ?? readLegacyConfig(projectRoot) ?? { source: 'none', options: {} };
    if (opts.cache !== false) {
      cache.set(projectRoot, loaded);
    }
  }
  return loaded;
}

// Note that this cannot actually cause an ESM config file to be re-evaluated,
// because node offers no way to evict an ES module that was loaded via
// require(). It does work for CJS config files and for the legacy config.
export function clearEmbroiderConfigCache(appRoot?: string) {
  if (appRoot) {
    cache.delete(locateProjectRoot(appRoot));
  } else {
    cache.clear();
  }
}

export function coreOptions(appRoot: string): CoreOptionsType {
  return optionsWithDefaults(loadEmbroiderConfig(appRoot).options as Options);
}

function readConfigFile(projectRoot: string): LoadedConfig | undefined {
  let filename = locateConfigFile(projectRoot);
  if (!filename) {
    return undefined;
  }
  let mod;
  try {
    // Our own cache is the one that matters, so make sure node's doesn't hand
    // us a stale CJS module. (This has no effect on ESM, see
    // clearEmbroiderConfigCache.)
    delete require.cache[filename];
    // node >= 20.19 can synchronously require ESM, and node versions with
    // type stripping can also synchronously require typescript.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mod = require(filename);
  } catch (err) {
    throw new Error(`Failed to load embroider config file ${filename}: ${(err as Error).message}`);
  }
  let options = mod?.__esModule || mod?.[Symbol.toStringTag] === 'Module' ? mod.default : mod;
  if (!options || typeof options !== 'object') {
    throw new Error(`Embroider config file ${filename} must have a default export that is an object`);
  }
  return { source: 'file', filename, options };
}

// ---- Deprecated support for embroider options in ember-cli-build.js ----

// These are the options that are consumed outside the ember-cli prebuild, so
// they need to get serialized into resolver.json when they come from
// ember-cli-build.js.
const runtimeLegacyOptions = [
  'staticInvokables',
  'allowUnsafeDynamicComponents',
  'splitAtRoutes',
  'staticAppPaths',
  'packageRules',
];

type SerializedPattern = { type: 'string'; value: string } | { type: 'regex'; value: string };

// Called by the ember-cli prebuild when the user passed embroider options in
// ember-cli-build.js. Within that process, these in-memory options become the
// config.
export function registerLegacyEmbroiderConfig(appRoot: string, options: object) {
  let projectRoot = locateProjectRoot(appRoot);
  let filename = locateConfigFile(projectRoot);
  if (filename) {
    throw new Error(
      `You have embroider options in ember-cli-build.js and also in ${filename}. Please move all of them into ${filename}.`
    );
  }
  console.warn(
    `DEPRECATION: passing embroider options in ember-cli-build.js is deprecated. Move them to an embroider.conf.mjs file in ${projectRoot}. See https://github.com/embroider-build/embroider#options`
  );
  cache.set(projectRoot, { source: 'ember-cli-build', options: options as Record<string, unknown> });
}

// The JSON that the prebuild should store in resolver.json so that other
// processes can see the legacy options.
export function serializeLegacyEmbroiderConfig(appRoot: string): Record<string, unknown> | undefined {
  let loaded = loadEmbroiderConfig(appRoot);
  if (loaded.source !== 'ember-cli-build') {
    return undefined;
  }
  let output: Record<string, unknown> = {};
  for (let key of runtimeLegacyOptions) {
    if (loaded.options[key] !== undefined) {
      output[key] = loaded.options[key];
    }
  }
  if (Array.isArray(output.splitAtRoutes)) {
    output.splitAtRoutes = (output.splitAtRoutes as (RegExp | string)[]).map(
      (s): SerializedPattern =>
        typeof s === 'string' ? { type: 'string', value: s } : { type: 'regex', value: s.toString() }
    );
  }
  return output;
}

function readLegacyConfig(projectRoot: string): LoadedConfig | undefined {
  let resolverFile = join(locateEmbroiderWorkingDir(projectRoot), 'resolver.json');
  if (!existsSync(resolverFile)) {
    return undefined;
  }
  let options = readJSONSync(resolverFile).legacyEmbroiderConfig;
  if (!options) {
    return undefined;
  }
  if (Array.isArray(options.splitAtRoutes)) {
    options.splitAtRoutes = options.splitAtRoutes.map((s: SerializedPattern) => {
      if (s.type === 'regex') {
        const fragments = s.value.match(/^\/(.*)\/([gimsuy]*)$/);
        if (!fragments) {
          throw new Error(`Unable to parse splitAtRoutes pattern ${s.value}`);
        }
        return new RegExp(fragments[1], fragments[2]);
      }
      return s.value;
    });
  }
  return { source: 'ember-cli-build', options };
}
