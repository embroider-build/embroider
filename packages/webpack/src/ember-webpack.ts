/*
  Most of the work this module does is putting an HTML-oriented facade around
  Webpack. That is, we want both the input and output to be primarily HTML files
  with proper spec semantics, and we use webpack to optimize the assets referred
  to by those files.

  While there are webpack plugins for handling HTML, none of them handle
  multiple HTML entrypoints and apply correct HTML semantics (for example,
  getting script vs module context correct).
*/

import type { AppMeta, BundleSummary, Packager, PackagerConstructor, Variant, ResolverOptions } from '@embroider/core';
import { HTMLEntrypoint, getAppMeta, getPackagerCacheDir, getOrCreate } from '@embroider/core';
import { locateEmbroiderWorkingDir, RewrittenPackageCache, tmpdir } from '@embroider/shared-internals';
import type { Configuration, RuleSetUseItem, WebpackPluginInstance } from 'webpack';
import webpack from 'webpack';
import type { Stats } from 'fs-extra';
import { readFileSync, outputFileSync, copySync, statSync, readJSONSync } from 'fs-extra';
import { join, dirname, relative, sep } from 'path';
import isEqual from 'lodash/isEqual';
import mergeWith from 'lodash/mergeWith';
import flatMap from 'lodash/flatMap';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import makeDebug from 'debug';
import { format } from 'util';
import { warmup as threadLoaderWarmup } from 'thread-loader';
import type { Options, BabelLoaderOptions } from './options';
import crypto from 'crypto';
import semverSatisfies from 'semver/functions/satisfies';
import supportsColor from 'supports-color';
import type { Options as HbsLoaderOptions } from '@embroider/hbs-loader';
import type { Options as EmbroiderPluginOptions } from './webpack-resolver-plugin';
import { EmbroiderPlugin } from './webpack-resolver-plugin';

const debug = makeDebug('embroider:debug');

// This is a type-only import, so it gets compiled away. At runtime, we load
// terser lazily so it's only loaded for production builds that use it. Don't
// add any non-type-only imports here.
import type { MinifyOptions } from 'terser';

interface AppInfo {
  entrypoints: HTMLEntrypoint[];
  otherAssets: string[];
  babel: AppMeta['babel'];
  rootURL: AppMeta['root-url'];
  publicAssetURL: string;
  resolverConfig: ResolverOptions;
  packageName: string;
}

// AppInfos are equal if they result in the same webpack config.
function equalAppInfo(left: AppInfo, right: AppInfo): boolean {
  return (
    isEqual(left.babel, right.babel) &&
    left.entrypoints.length === right.entrypoints.length &&
    left.entrypoints.every((e, index) => isEqual(e.modules, right.entrypoints[index].modules))
  );
}

type BeginFn = (total: number) => void;
type IncrementFn = () => Promise<void>;

function createBarrier(): [BeginFn, IncrementFn] {
  const barriers: Array<[() => void, (e: unknown) => void]> = [];
  let done = true;
  let limit = 0;
  return [begin, increment];

  function begin(newLimit: number) {
    if (!done) flush(new Error('begin called before limit reached'));
    done = false;
    limit = newLimit;
  }

  async function increment() {
    if (done) {
      throw new Error('increment after limit reach');
    }
    const promise = new Promise<void>((resolve, reject) => {
      barriers.push([resolve, reject]);
    });
    if (barriers.length === limit) {
      flush();
    }
    await promise;
  }

  function flush(err?: Error) {
    for (const [resolve, reject] of barriers) {
      if (err) reject(err);
      else resolve();
    }
    barriers.length = 0;
    done = true;
  }
}

// we want to ensure that not only does our instance conform to
// PackagerInstance, but our constructor conforms to Packager. So instead of
// just exporting our class directly, we export a const constructor of the
// correct type.
const Webpack: PackagerConstructor<Options> = class Webpack implements Packager {
  static annotation = '@embroider/webpack';

  private pathToVanillaApp: string;
  private extraConfig: Configuration | undefined;
  private passthroughCache: Map<string, Stats> = new Map();
  private publicAssetURL: string | undefined;
  private extraThreadLoaderOptions: object | false | undefined;
  private extraBabelLoaderOptions: BabelLoaderOptions | undefined;
  private extraCssLoaderOptions: object | undefined;
  private extraStyleLoaderOptions: object | undefined;
  private _bundleSummary: BundleSummary | undefined;
  private beginBarrier: BeginFn;
  private incrementBarrier: IncrementFn;

  constructor(
    private appRoot: string,
    private outputPath: string,
    private variants: Variant[],
    private consoleWrite: (msg: string) => void,
    options?: Options
  ) {
    if (!semverSatisfies(webpack.version, '^5.0.0')) {
      throw new Error(`@embroider/webpack requires webpack@^5.0.0, but found version ${webpack.version}`);
    }

    let packageCache = RewrittenPackageCache.shared('embroider', appRoot);
    this.pathToVanillaApp = packageCache.maybeMoved(packageCache.get(appRoot)).root;
    this.extraConfig = options?.webpackConfig;
    this.publicAssetURL = options?.publicAssetURL;
    this.extraThreadLoaderOptions = options?.threadLoaderOptions;
    this.extraBabelLoaderOptions = options?.babelLoaderOptions;
    this.extraCssLoaderOptions = options?.cssLoaderOptions;
    this.extraStyleLoaderOptions = options?.styleLoaderOptions;
    [this.beginBarrier, this.incrementBarrier] = createBarrier();
    warmUp(this.extraThreadLoaderOptions);
  }

  get bundleSummary(): BundleSummary {
    let bundleSummary = this._bundleSummary;
    if (bundleSummary === undefined) {
      this._bundleSummary = bundleSummary = {
        entrypoints: new Map(),
        lazyBundles: new Map(),
        variants: this.variants,
      };
    }
    return bundleSummary;
  }

  async build(): Promise<void> {
    this._bundleSummary = undefined;
    this.beginBarrier(this.variants.length);
    let appInfo = this.examineApp();
    let webpack = this.getWebpack(appInfo);
    await this.runWebpack(webpack);
  }

  private examineApp(): AppInfo {
    let meta = getAppMeta(this.pathToVanillaApp);
    let rootURL = meta['ember-addon']['root-url'];
    let babel = meta['ember-addon']['babel'];
    let entrypoints = [];
    let otherAssets = [];
    let publicAssetURL = this.publicAssetURL || rootURL;

    for (let relativePath of meta['ember-addon'].assets) {
      if (/\.html/i.test(relativePath)) {
        entrypoints.push(new HTMLEntrypoint(this.pathToVanillaApp, rootURL, publicAssetURL, relativePath));
      } else {
        otherAssets.push(relativePath);
      }
    }

    let resolverConfig: EmbroiderPluginOptions = readJSONSync(
      join(locateEmbroiderWorkingDir(this.appRoot), 'resolver.json')
    );

    return { entrypoints, otherAssets, babel, rootURL, resolverConfig, publicAssetURL, packageName: meta.name };
  }

  private configureWebpack(appInfo: AppInfo, variant: Variant, variantIndex: number): Configuration {
    const { entrypoints, babel, publicAssetURL, packageName, resolverConfig } = appInfo;

    let entry: { [name: string]: string } = {};
    for (let entrypoint of entrypoints) {
      for (let moduleName of entrypoint.modules) {
        entry[moduleName] = './' + moduleName;
      }
    }

    let { plugins: stylePlugins, loaders: styleLoaders } = this.setupStyleConfig(variant);

    let babelLoaderOptions = makeBabelLoaderOptions(
      babel.majorVersion,
      variant,
      join(this.pathToVanillaApp, babel.filename),
      this.extraBabelLoaderOptions
    );

    let babelLoaderPrefix = `babel-loader-9?${JSON.stringify(babelLoaderOptions.options)}!`;

    return {
      mode: variant.optimizeForProduction ? 'production' : 'development',
      context: this.pathToVanillaApp,
      entry,
      performance: {
        hints: false,
      },
      plugins: [
        ...stylePlugins,
        new EmbroiderPlugin(resolverConfig, babelLoaderPrefix),
        compiler => {
          compiler.hooks.done.tapPromise('EmbroiderPlugin', async stats => {
            this.summarizeStats(stats, variant, variantIndex);
            await this.writeFiles(this.bundleSummary, this.lastAppInfo!, variantIndex);
          });
        },
      ],
      node: false,
      module: {
        rules: [
          {
            test: /\.hbs$/,
            use: nonNullArray([
              maybeThreadLoader(babel.isParallelSafe, this.extraThreadLoaderOptions),
              babelLoaderOptions,
              {
                loader: require.resolve('@embroider/hbs-loader'),
                options: (() => {
                  let options: HbsLoaderOptions = {
                    compatModuleNaming: {
                      rootDir: this.pathToVanillaApp,
                      modulePrefix: packageName,
                    },
                  };
                  return options;
                })(),
              },
            ]),
          },
          {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            test: require(join(this.pathToVanillaApp, babel.fileFilter)),
            use: nonNullArray([
              maybeThreadLoader(babel.isParallelSafe, this.extraThreadLoaderOptions),
              makeBabelLoaderOptions(
                babel.majorVersion,
                variant,
                join(this.pathToVanillaApp, babel.filename),
                this.extraBabelLoaderOptions
              ),
            ]),
          },
          {
            test: isCSS,
            use: styleLoaders,
          },
        ],
      },
      output: {
        path: join(this.outputPath),
        filename: `assets/chunk.[chunkhash].js`,
        chunkFilename: `assets/chunk.[chunkhash].js`,
        publicPath: publicAssetURL,
      },
      optimization: {
        splitChunks: {
          chunks: 'all',
        },
      },
      resolve: {
        extensions: resolverConfig.resolvableExtensions,
      },
      resolveLoader: {
        alias: {
          // these loaders are our dependencies, not the app's dependencies. I'm
          // not overriding the default loader resolution rules in case the app also
          // wants to control those.
          'thread-loader': require.resolve('thread-loader'),
          'babel-loader-9': require.resolve('@embroider/babel-loader-9'),
          'css-loader': require.resolve('css-loader'),
          'style-loader': require.resolve('style-loader'),
        },
      },
    };
  }

  private lastAppInfo: AppInfo | undefined;
  private lastWebpack: webpack.MultiCompiler | undefined;

  private getWebpack(appInfo: AppInfo) {
    if (this.lastWebpack && this.lastAppInfo && equalAppInfo(appInfo, this.lastAppInfo)) {
      debug(`reusing webpack config`);
      // the appInfos result in equal webpack configs so we don't need to
      // reconfigure webpack. But they may contain other changes (like HTML
      // content changes that don't alter the webpack config) so we still want
      // lastAppInfo to update so that the latest one will be seen in the
      // webpack post-build.
      this.lastAppInfo = appInfo;
      return this.lastWebpack;
    }
    debug(`configuring webpack`);
    let config = this.variants.map((variant, variantIndex) =>
      mergeWith({}, this.configureWebpack(appInfo, variant, variantIndex), this.extraConfig, appendArrays)
    );
    this.lastAppInfo = appInfo;
    return (this.lastWebpack = webpack(config));
  }

  private async writeScript(script: string, written: Set<string>, variant: Variant) {
    if (!variant.optimizeForProduction) {
      this.copyThrough(script);
      return script;
    }

    // loading these lazily here so they never load in non-production builds.
    // The node cache will ensures we only load them once.
    const [Terser, srcURL] = await Promise.all([import('terser'), import('source-map-url')]);

    let inCode = readFileSync(join(this.pathToVanillaApp, script), 'utf8');
    let terserOpts: MinifyOptions = {};
    let fileRelativeSourceMapURL;
    let appRelativeSourceMapURL;
    if (srcURL.default.existsIn(inCode)) {
      fileRelativeSourceMapURL = srcURL.default.getFrom(inCode)!;
      appRelativeSourceMapURL = join(dirname(script), fileRelativeSourceMapURL);
      let content;
      try {
        content = readJSONSync(join(this.pathToVanillaApp, appRelativeSourceMapURL));
      } catch (err) {
        // the script refers to a sourcemap that doesn't exist, so we just leave
        // the map out.
      }
      if (content) {
        terserOpts.sourceMap = { content, url: fileRelativeSourceMapURL };
      }
    }
    let { code: outCode, map: outMap } = await Terser.default.minify(inCode, terserOpts);
    let finalFilename = this.getFingerprintedFilename(script, outCode!);
    outputFileSync(join(this.outputPath, finalFilename), outCode!);
    written.add(script);
    if (appRelativeSourceMapURL && outMap) {
      outputFileSync(join(this.outputPath, appRelativeSourceMapURL), outMap);
      written.add(appRelativeSourceMapURL);
    }
    return finalFilename;
  }

  private async writeStyle(style: string, written: Set<string>, variant: Variant) {
    if (!variant.optimizeForProduction) {
      this.copyThrough(style);
      written.add(style);
      return style;
    }

    const csso = await import('csso');
    const cssContent = readFileSync(join(this.pathToVanillaApp, style), 'utf8');
    const minifiedCss = csso.minify(cssContent).css;

    let finalFilename = this.getFingerprintedFilename(style, minifiedCss);
    outputFileSync(join(this.outputPath, finalFilename), minifiedCss);
    written.add(style);
    return finalFilename;
  }

  private async provideErrorContext(message: string, messageParams: any[], fn: () => Promise<void>) {
    try {
      return await fn();
    } catch (err) {
      let context = format(message, ...messageParams);
      err.message = context + ': ' + err.message;
      throw err;
    }
  }

  private async writeFiles(stats: BundleSummary, { entrypoints, otherAssets }: AppInfo, variantIndex: number) {
    // we're doing this ourselves because I haven't seen a webpack 4 HTML plugin
    // that handles multiple HTML entrypoints correctly.

    let written: Set<string> = new Set();
    // scripts (as opposed to modules) and stylesheets (as opposed to CSS
    // modules that are imported from JS modules) get passed through without
    // going through webpack.
    for (let entrypoint of entrypoints) {
      await this.provideErrorContext('needed by %s', [entrypoint.filename], async () => {
        for (let script of entrypoint.scripts) {
          if (!stats.entrypoints.has(script)) {
            const mapping = [] as string[];
            try {
              // zero here means we always attribute passthrough scripts to the
              // first build variant
              stats.entrypoints.set(script, new Map([[0, mapping]]));
              mapping.push(await this.writeScript(script, written, this.variants[0]));
            } catch (err) {
              if (err.code === 'ENOENT' && err.path === join(this.pathToVanillaApp, script)) {
                this.consoleWrite(
                  `warning: in ${entrypoint.filename} <script src="${script
                    .split(sep)
                    .join(
                      '/'
                    )}"> does not exist on disk. If this is intentional, use a data-embroider-ignore attribute.`
                );
              } else {
                throw err;
              }
            }
          }
        }
        for (let style of entrypoint.styles) {
          if (!stats.entrypoints.has(style)) {
            const mapping = [] as string[];
            try {
              // zero here means we always attribute passthrough styles to the
              // first build variant
              stats.entrypoints.set(style, new Map([[0, mapping]]));
              mapping.push(await this.writeStyle(style, written, this.variants[0]));
            } catch (err) {
              if (err.code === 'ENOENT' && err.path === join(this.pathToVanillaApp, style)) {
                this.consoleWrite(
                  `warning: in ${entrypoint.filename}  <link rel="stylesheet" href="${style
                    .split(sep)
                    .join(
                      '/'
                    )}"> does not exist on disk. If this is intentional, use a data-embroider-ignore attribute.`
                );
              } else {
                throw err;
              }
            }
          }
        }
      });
    }
    // we need to wait for both compilers before writing html entrypoint
    await this.incrementBarrier();
    // only the first variant should write it.
    if (variantIndex === 0) {
      for (let entrypoint of entrypoints) {
        this.writeIfChanged(join(this.outputPath, entrypoint.filename), entrypoint.render(stats));
        written.add(entrypoint.filename);
      }
    }

    for (let relativePath of otherAssets) {
      if (!written.has(relativePath)) {
        written.add(relativePath);
        await this.provideErrorContext(`while copying app's assets`, [], async () => {
          this.copyThrough(relativePath);
        });
      }
    }
  }

  private lastContents = new Map<string, string>();

  // The point of this caching isn't really performance (we generate the
  // contents either way, and the actual write is unlikely to be expensive).
  // It's helping ember-cli's traditional livereload system to avoid triggering
  // a full page reload when that wasn't really necessary.
  private writeIfChanged(filename: string, content: string) {
    if (this.lastContents.get(filename) !== content) {
      outputFileSync(filename, content, 'utf8');
      this.lastContents.set(filename, content);
    }
  }

  private copyThrough(relativePath: string) {
    let sourcePath = join(this.pathToVanillaApp, relativePath);
    let newStats = statSync(sourcePath);
    let oldStats = this.passthroughCache.get(sourcePath);
    if (!oldStats || oldStats.mtimeMs !== newStats.mtimeMs || oldStats.size !== newStats.size) {
      debug(`emitting ${relativePath}`);
      copySync(sourcePath, join(this.outputPath, relativePath));
      this.passthroughCache.set(sourcePath, newStats);
    }
  }

  private getFingerprintedFilename(filename: string, content: string): string {
    let md5 = crypto.createHash('md5');
    md5.update(content);
    let hash = md5.digest('hex');

    let fileParts = filename.split('.');
    fileParts.splice(fileParts.length - 1, 0, hash);
    return fileParts.join('.');
  }

  private summarizeStats(stats: webpack.Stats, variant: Variant, variantIndex: number): void {
    let output = this.bundleSummary;
    let { entrypoints, chunks } = stats.toJson({
      all: false,
      entrypoints: true,
      chunks: true,
    });

    // webpack's types are written rather loosely, implying that these two
    // properties may not be present. They really always are, as far as I can
    // tell, but we need to check here anyway to satisfy the type checker.
    if (!entrypoints) {
      throw new Error(`unexpected webpack output: no entrypoints`);
    }
    if (!chunks) {
      throw new Error(`unexpected webpack output: no chunks`);
    }

    for (let id of Object.keys(entrypoints)) {
      let { assets: entrypointAssets } = entrypoints[id];
      if (!entrypointAssets) {
        throw new Error(`unexpected webpack output: no entrypoint.assets`);
      }

      getOrCreate(output.entrypoints, id, () => new Map()).set(
        variantIndex,
        entrypointAssets.map(asset => asset.name)
      );
      if (variant.runtime !== 'browser') {
        // in the browser we don't need to worry about lazy assets (they will be
        // handled automatically by webpack as needed), but in any other runtime
        // we need the ability to preload them
        output.lazyBundles.set(
          id,
          flatMap(
            chunks.filter(chunk => chunk.runtime?.includes(id)),
            chunk => chunk.files
          ).filter(file => !entrypointAssets?.find(a => a.name === file)) as string[]
        );
      }
    }
  }

  private runWebpack(webpack: webpack.MultiCompiler): Promise<webpack.MultiStats> {
    return new Promise((resolve, reject) => {
      webpack.run((err, stats) => {
        try {
          if (err) {
            if (stats) {
              this.consoleWrite(stats.toString());
            }
            throw err;
          }
          if (!stats) {
            // this doesn't really happen, but webpack's types imply that it
            // could, so we just satisfy typescript here
            throw new Error('bug: no stats and no err');
          }
          if (stats.hasErrors()) {
            // write all the stats output to the console
            this.consoleWrite(
              stats.toString({
                colors: Boolean(supportsColor.stdout),
              })
            );

            // the typing for MultiCompiler are all foobared.
            throw this.findBestError(flatMap((stats as any).stats, s => s.compilation.errors));
          }
          if (stats.hasWarnings() || process.env.VANILLA_VERBOSE) {
            this.consoleWrite(
              stats.toString({
                colors: Boolean(supportsColor.stdout),
              })
            );
          }
          resolve(stats);
        } catch (e) {
          reject(e);
        }
      });
    });
  }

  private setupStyleConfig(variant: Variant): {
    loaders: RuleSetUseItem[];
    plugins: WebpackPluginInstance[];
  } {
    let cssLoader = {
      loader: 'css-loader',
      options: {
        url: true,
        import: true,
        modules: 'global',
        ...this.extraCssLoaderOptions,
      },
    };

    if (!variant.optimizeForProduction && variant.runtime === 'browser') {
      // in development builds that only need to work in the browser (not
      // fastboot), we can use style-loader because it's fast
      return {
        loaders: [
          { loader: 'style-loader', options: { injectType: 'styleTag', ...this.extraStyleLoaderOptions } },
          cssLoader,
        ],
        plugins: [],
      };
    } else {
      // in any other build, we separate the CSS into its own bundles
      return {
        loaders: [MiniCssExtractPlugin.loader, cssLoader],
        plugins: [
          new MiniCssExtractPlugin({
            filename: `assets/chunk.[chunkhash].css`,
            chunkFilename: `assets/chunk.[chunkhash].css`,
            // in the browser, MiniCssExtractPlugin can manage it's own runtime
            // lazy loading of stylesheets.
            //
            // but in fastboot, we need to disable that in favor of doing our
            // own insertion of `<link>` tags in the HTML
            runtime: variant.runtime === 'browser',
            // It's not reasonable to make assumptions about order when doing CSS via modules
            ignoreOrder: true,
          }),
        ],
      };
    }
  }

  private findBestError(errors: any[]) {
    let error = errors[0];
    let file;
    if (error.module?.userRequest) {
      file = relative(this.pathToVanillaApp, error.module.userRequest);
    }

    if (!error.file) {
      error.file = file || (error.loc ? error.loc.file : null) || (error.location ? error.location.file : null);
    }
    if (error.line == null) {
      error.line = (error.loc ? error.loc.line : null) || (error.location ? error.location.line : null);
    }
    if (typeof error.message === 'string') {
      if (error.module?.context) {
        error.message = error.message.replace(error.module.context, error.module.userRequest);
      }

      // the tmpdir on OSX is horribly long and makes error messages hard to
      // read. This is doing the same as String.prototype.replaceAll, which node
      // doesn't have yet.
      error.message = error.message.split(tmpdir).join('$TMPDIR');
    }
    return error;
  }
};

const threadLoaderOptions = {
  workers: 'JOBS' in process.env && Number(process.env.JOBS),
  // poolTimeout shuts down idle workers. The problem is, for
  // interactive rebuilds that means your startup cost for the
  // next rebuild is at least 600ms worse. So we insist on
  // keeping workers alive always.
  poolTimeout: Infinity,
};

function canUseThreadLoader(extraOptions: object | false | undefined) {
  // If the environment sets JOBS to 0, or if our extraOptions are set to false,
  // we have been explicitly configured not to use thread-loader
  if (process.env.JOBS === '0' || extraOptions === false) {
    return false;
  } else {
    return true;
  }
}

function warmUp(extraOptions: object | false | undefined) {
  // We don't know if we'll be parallel-safe or not, but if we've been
  // configured to not use thread-loader, then there is no need to consume extra
  // resources warming the worker pool
  if (!canUseThreadLoader(extraOptions)) {
    return null;
  }

  threadLoaderWarmup(Object.assign({}, threadLoaderOptions, extraOptions), [
    require.resolve('@embroider/hbs-loader'),
    require.resolve('@embroider/babel-loader-9'),
  ]);
}

function maybeThreadLoader(isParallelSafe: boolean, extraOptions: object | false | undefined) {
  if (!canUseThreadLoader(extraOptions) || !isParallelSafe) {
    return null;
  }

  return {
    loader: 'thread-loader',
    options: Object.assign({}, threadLoaderOptions, extraOptions),
  };
}

function appendArrays(objValue: any, srcValue: any) {
  if (Array.isArray(objValue)) {
    return objValue.concat(srcValue);
  }
}

function isCSS(filename: string) {
  return /\.css$/i.test(filename);
}

// typescript doesn't understand that regular use of array.filter(Boolean) does
// this.
function nonNullArray<T>(array: T[]): NonNullable<T>[] {
  return array.filter(Boolean) as NonNullable<T>[];
}

function makeBabelLoaderOptions(
  _majorVersion: 7,
  variant: Variant,
  appBabelConfigPath: string,
  extraOptions: BabelLoaderOptions | undefined
) {
  const cacheDirectory = getPackagerCacheDir('webpack-babel-loader');
  const options: BabelLoaderOptions & { variant: Variant; appBabelConfigPath: string } = {
    variant,
    appBabelConfigPath,
    cacheDirectory,
    ...extraOptions,
  };
  return {
    loader: 'babel-loader-9',
    options,
  };
}

export { Webpack };
