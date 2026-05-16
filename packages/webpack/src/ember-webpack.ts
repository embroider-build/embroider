/*
  This is the modern @embroider/webpack. It mirrors the architecture of
  @embroider/vite: the app keeps its real index.html / tests/index.html (with
  {{content-for}} placeholders and /@embroider/virtual/* references), the
  compat prebuild produces the .embroider working directory, and webpack
  bundles using @embroider/core's Resolver + virtual content.

  Just like vite, there are two plugins and they mutate the (webpack) config
  rather than owning it:

      const { classicEmberSupport, ember } = require('@embroider/webpack');
      module.exports = {
        plugins: [classicEmberSupport(), ember()],
      };

  - classicEmberSupport(): the compat prebuild, content-for, the public-assets
    of v2 addons, and the .hbs rule (analogous to vite's classicEmberSupport()).
  - ember(): the resolver, the template-tag/babel/css rules, the build config
    mutation, and the html entrypoints (analogous to vite's ember()).

  Apps wire `buildOnce` into ember-cli-build.js via @embroider/compat's
  `compatBuild`.
*/

import { join } from 'path';
import { getPackagerCacheDir, type Variant } from '@embroider/core';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import type { Compiler, RuleSetRule } from 'webpack';
import { EmbroiderPlugin } from './webpack-resolver-plugin';
import { compatPrebuild, runCompatPrebuild } from './compat-prebuild';
import { discoverHtmlEntrypoints, HtmlOutputPlugin, type HtmlState } from './html-output-plugin';
import { AssetsPlugin } from './assets-plugin';
import type { Options } from './options';

// Matches vite's `extensions` export.
export const extensions = ['.mjs', '.gjs', '.js', '.mts', '.gts', '.ts', '.hbs', '.hbs.js', '.json'];

function emberEnv(mode: string | undefined): 'development' | 'test' | 'production' {
  let env = process.env.EMBER_ENV;
  if (env === 'production' || env === 'test' || env === 'development') {
    return env;
  }
  if (mode === 'production') {
    return 'production';
  }
  return process.env.NODE_ENV === 'production' ? 'production' : 'development';
}

// Mirrors vite's `shouldBuildTests`.
function shouldBuildTests(env: 'development' | 'test' | 'production'): boolean {
  let build = env !== 'production' || Boolean(process.env.FORCE_BUILD_TESTS);
  if (build) {
    process.env.EMBER_CLI_TEST_COMMAND = 'true';
  }
  return build;
}

interface Shared {
  appRoot: string;
  prebuildEnv: 'development' | 'production';
  includeTests: boolean;
  htmlState: HtmlState;
  // set by classicEmberSupport(); ember() reads it to decide whether to run
  // the compat prebuild + apply content-for (a fully-v2 app uses only ember()).
  classic: boolean;
}

// classicEmberSupport() and ember() coordinate through one Shared object per
// compiler, regardless of the order they appear in the plugins array.
const sharedByCompiler = new WeakMap<Compiler, Shared>();

function getShared(compiler: Compiler, options: Options): Shared {
  let existing = sharedByCompiler.get(compiler);
  if (existing) {
    return existing;
  }
  const opts = compiler.options;
  const appRoot = (opts.context as string) || process.cwd();
  const env = emberEnv(opts.mode);
  const publicAssetURL = options.publicAssetURL || '/';
  const shared: Shared = {
    appRoot,
    prebuildEnv: env === 'production' ? 'production' : 'development',
    includeTests: shouldBuildTests(env),
    htmlState: { appRoot, publicAssetURL, records: [], applyContentFor: false },
    classic: false,
  };
  sharedByCompiler.set(compiler, shared);
  return shared;
}

export function classicEmberSupport(options: Options = {}) {
  return {
    apply(compiler: Compiler) {
      const shared = getShared(compiler, options);
      shared.classic = true;
      shared.htmlState.applyContentFor = true;

      const { appRoot, prebuildEnv } = shared;

      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const appName: string = require(join(appRoot, 'package.json')).name;

      const opts = compiler.options;
      addLoaderAlias(compiler, 'embroider-hbs-loader', require.resolve('@embroider/hbs-loader'));
      opts.module.rules.push({
        test: /\.hbs$/,
        use: [
          { loader: 'babel-loader-9', options: babelLoaderOptions(shared, options) },
          {
            loader: 'embroider-hbs-loader',
            options: { compatModuleNaming: { rootDir: appRoot, modulePrefix: appName } },
          },
        ],
      });

      compatPrebuild(prebuildEnv, extensions).apply(compiler);
      new AssetsPlugin(appRoot).apply(compiler);
    },
  };
}

export function ember(options: Options = {}) {
  return {
    apply(compiler: Compiler) {
      const shared = getShared(compiler, options);
      const { appRoot, prebuildEnv, includeTests, htmlState } = shared;
      const opts = compiler.options;
      const publicAssetURL = options.publicAssetURL || '/';
      const outputPath = process.env.EMBROIDER_WEBPACK_OUTDIR
        ? join(appRoot, process.env.EMBROIDER_WEBPACK_OUTDIR)
        : opts.output?.path || join(appRoot, 'dist');

      // ---- mutate the user's config (like vite's config() hook) ----

      opts.context = appRoot;
      if (opts.node === undefined) {
        opts.node = false;
      }
      if (opts.performance && typeof opts.performance === 'object') {
        opts.performance.hints ??= false;
      }

      // embroider owns entry. We set it to an async function (webpack supports
      // this) so the compat prebuild has produced resolver.json /
      // content-for.json before we discover the html entrypoints.
      opts.entry = (async () => {
        if (shared.classic) {
          await runCompatPrebuild(prebuildEnv, extensions);
        }
        return discoverHtmlEntrypoints(htmlState, includeTests);
      }) as unknown as typeof opts.entry;

      if (!opts.resolve.extensions || opts.resolve.extensions.length === 0) {
        opts.resolve.extensions = extensions;
      }

      addLoaderAlias(compiler, 'babel-loader-9', require.resolve('@embroider/babel-loader-9'));
      addLoaderAlias(compiler, 'css-loader', require.resolve('css-loader'));
      addLoaderAlias(compiler, 'style-loader', require.resolve('style-loader'));
      addLoaderAlias(compiler, 'embroider-template-tag-loader', require.resolve('./template-tag-loader.js'));

      opts.optimization.splitChunks ??= { chunks: 'all' };

      opts.output.path = outputPath;
      opts.output.filename ??= 'assets/chunk.[contenthash].js';
      opts.output.chunkFilename ??= 'assets/chunk.[contenthash].js';
      opts.output.publicPath ??= publicAssetURL;
      opts.output.clean ??= true;

      // fastboot-only modules use top-level await import()
      (opts.experiments as { topLevelAwait?: boolean }).topLevelAwait ??= true;

      const cssLoader = {
        loader: 'css-loader',
        options: {
          url: true,
          import: true,
          modules: 'global',
          ...options.cssLoaderOptions,
        },
      };
      const rules: RuleSetRule[] = [
        {
          test: /\.g[jt]s$/,
          use: [
            { loader: 'babel-loader-9', options: babelLoaderOptions(shared, options) },
            { loader: 'embroider-template-tag-loader' },
          ],
        },
        {
          test: /\.m?[jt]s$/,
          exclude: /\.g[jt]s$/,
          use: [{ loader: 'babel-loader-9', options: babelLoaderOptions(shared, options) }],
        },
        {
          test: /\.css$/i,
          use: [MiniCssExtractPlugin.loader, cssLoader],
        },
      ];
      opts.module.rules.push(...rules);

      // ---- apply the embroider sub-plugins ----

      new EmbroiderPlugin(appRoot, babelLoaderPrefix(shared, options)).apply(compiler);
      new MiniCssExtractPlugin({
        filename: 'assets/chunk.[contenthash].css',
        chunkFilename: 'assets/chunk.[contenthash].css',
        ignoreOrder: true,
        ...options.cssPluginOptions,
      }).apply(compiler);
      new HtmlOutputPlugin(htmlState).apply(compiler);
    },
  };
}

function variantFor(shared: Shared): Variant {
  let mode = shared.prebuildEnv;
  return {
    name: mode,
    runtime: 'browser',
    optimizeForProduction: mode === 'production',
  };
}

function babelLoaderOptions(shared: Shared, options: Options) {
  return {
    variant: variantFor(shared),
    appBabelConfigPath: join(shared.appRoot, 'babel.config.cjs'),
    cacheDirectory: getPackagerCacheDir('webpack-babel-loader'),
    ...options.babelLoaderOptions,
  };
}

function babelLoaderPrefix(shared: Shared, options: Options): string {
  return `babel-loader-9?${JSON.stringify(babelLoaderOptions(shared, options))}!`;
}

function addLoaderAlias(compiler: Compiler, name: string, alias: string) {
  let { resolveLoader } = compiler.options;
  if (Array.isArray(resolveLoader.alias)) {
    resolveLoader.alias.push({ name, alias });
  } else if (resolveLoader.alias) {
    (resolveLoader.alias as Record<string, string>)[name] ??= alias;
  } else {
    resolveLoader.alias = { [name]: alias };
  }
}
