import type { PluginItem } from '@babel/core';
import { existsSync } from 'fs';
import {
  locateEmbroiderWorkingDir,
  ResolverLoader,
  templateColocationPluginPath,
  type TemplateColocationPluginOptions,
} from '@embroider/core';
import { join } from 'path';
import type { Transform } from 'babel-plugin-ember-template-compilation';
import type { Options as ResolverTransformOptions } from './resolver-transform';
import type { Options as AdjustImportsOptions } from './babel-plugin-adjust-imports';

export interface CompatBabelState {
  plugins: PluginItem[];
  templateTransforms: Transform[];
  babelMacros: PluginItem[];
  templateMacros: Transform[];
}

function loadCompatConfig(): CompatBabelState {
  let compatFile = join(locateEmbroiderWorkingDir(process.cwd()), '_babel_compat_.js');
  if (existsSync(compatFile)) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require(compatFile);
  }
  return {
    plugins: [],
    templateTransforms: [],
    babelMacros: [],
    templateMacros: [],
  };
}

const resolverLoader = new ResolverLoader(process.cwd());

export function pluginsFromV1Addons() {
  let config = loadCompatConfig();
  return config.plugins;
}

export function transformsFromV1Addons() {
  let config = loadCompatConfig();
  return config.templateTransforms;
}

export function looseModeSupport(): Transform {
  const { resolver } = resolverLoader;
  let opts: ResolverTransformOptions = {
    appRoot: resolver.options.appRoot,
    emberVersion: resolver.options.emberVersion,
  };
  return [require.resolve('./resolver-transform'), opts];
}

export function templateMacros() {
  let config = loadCompatConfig();
  return config.templateMacros;
}

export function babelMacros() {
  let config = loadCompatConfig();
  return config.babelMacros;
}

export function adjustImports() {
  let pluginConfig: AdjustImportsOptions = {
    appRoot: resolverLoader.resolver.options.appRoot,
  };
  return [require.resolve('./babel-plugin-adjust-imports'), pluginConfig];
}

export function oldDebugMacros(): PluginItem[] {
  let debugMacros = require.resolve('babel-plugin-debug-macros');
  return [
    [
      debugMacros,
      {
        flags: [
          {
            source: '@glimmer/env',
            flags: {
              DEBUG: true,
              CI: false,
            },
          },
        ],
        debugTools: {
          isDebug: true,
          source: '@ember/debug',
          assertPredicateIndex: 1,
        },
        externalizeHelpers: {
          module: '@ember/debug',
        },
      },
      '@ember/debug stripping',
    ],
    [
      debugMacros,
      {
        externalizeHelpers: {
          module: '@ember/application/deprecations',
        },
        debugTools: {
          isDebug: true,
          source: '@ember/application/deprecations',
          assertPredicateIndex: 1,
        },
      },
      '@ember/application/deprecations stripping',
    ],
  ];
}

export function templateColocation(): PluginItem {
  let colocationOptions: TemplateColocationPluginOptions = {
    appRoot: resolverLoader.resolver.options.appRoot,

    // This extra weirdness is a compromise in favor of build performance.
    //
    // 1. When auto-upgrading an addon from v1 to v2, we definitely want to
    //    run any custom AST transforms in stage1.
    //
    // 2. In general case, AST transforms are allowed to manipulate Javascript
    //    scope. This means that running transforms -- even when we're doing
    //    source-to-source compilation that emits handlebars and not wire
    //    format -- implies changing .hbs files into .js files.
    //
    // 3. So stage1 may need to rewrite .hbs to .hbs.js (to avoid colliding
    //    with an existing co-located .js file).
    //
    // 4. But stage1 doesn't necessarily want to run babel over the
    //    corresponding JS file. Most of the time, that's just an
    //    unnecessarily expensive second parse. (We only run it in stage1 to
    //    eliminate an addon's custom babel plugins, and many addons don't
    //    have any.)
    //
    // 5. Therefore, the work of template-colocation gets defered until here,
    //    and it may see co-located templates named `.hbs.js` instead of the
    //    usual `.hbs.
    templateExtensions: ['.hbs', '.hbs.js'],

    // All of the above only applies to auto-upgraded packages that were
    // authored in v1. V2 packages don't get any of this complexity, they're
    // supposed to take care of colocating their own templates explicitly.
    packageGuard: true,
  };
  return [templateColocationPluginPath, colocationOptions];
}

export function babelCompatSupport(): PluginItem[] {
  return [...babelMacros(), adjustImports(), ...oldDebugMacros(), templateColocation(), ...pluginsFromV1Addons()];
}

export function templateCompatSupport(): Transform[] {
  return [looseModeSupport(), ...templateMacros(), ...transformsFromV1Addons()];
}
