/*
  Most of the work this module does is putting an HTML-oriented facade around
  Webpack. That is, we want both the input and output to be primarily HTML files
  with proper spec semantics, and we use webpack to optimize the assets referred
  to by those files.

  While there are webpack plugins for handling HTML, none of them handle
  multiple HTML entrypoints and apply correct HTML semantics (for example,
  getting script vs module context correct).
*/

import {
  AppMeta,
  HTMLEntrypoint,
  BundleSummary,
  Packager,
  PackagerConstructor,
  Variant,
  getAppMeta,
  getPackagerCacheDir,
  getOrCreate,
} from '@embroider/core';
import { tmpdir } from '@embroider/shared-internals';
import webpack, { Configuration } from 'webpack';
import { readFileSync, outputFileSync, copySync, realpathSync, Stats, statSync, readJsonSync } from 'fs-extra';
import { join, dirname, relative, sep } from 'path';
import isEqual from 'lodash/isEqual';
import mergeWith from 'lodash/mergeWith';
import flatMap from 'lodash/flatMap';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import makeDebug from 'debug';
import { format } from 'util';
import { warmup as threadLoaderWarmup } from 'thread-loader';
import { Options, BabelLoaderOptions } from './options';
import crypto from 'crypto';
import type { HbsLoaderConfig } from '@embroider/hbs-loader';
import semverSatisfies from 'semver/functions/satisfies';
import supportsColor from 'supports-color';

const debug = makeDebug('embroider:debug');

// This is a type-only import, so it gets compiled away. At runtime, we load
// terser lazily so it's only loaded for production builds that use it. Don't
// add any non-type-only imports here.
import type { MinifyOptions } from 'terser';

interface AppInfo {
  entrypoints: HTMLEntrypoint[];
  otherAssets: string[];
  templateCompiler: AppMeta['template-compiler'];
  babel: AppMeta['babel'];
  rootURL: AppMeta['root-url'];
  publicAssetURL: string;
  resolvableExtensions: AppMeta['resolvable-extensions'];
}

// AppInfos are equal if they result in the same webpack config.
function equalAppInfo(left: AppInfo, right: AppInfo): boolean {
  return (
    isEqual(left.babel, right.babel) &&
    left.entrypoints.length === right.entrypoints.length &&
    left.entrypoints.every((e, index) => isEqual(e.modules, right.entrypoints[index].modules))
  );
}

// we want to ensure that not only does our instance conform to
// PackagerInstance, but our constructor conforms to Packager. So instead of
// just exporting our class directly, we export a const constructor of the
// correct type.
const Webpack: PackagerConstructor<Options> = class Webpack implements Packager {
  static annotation = '@embroider/webpack';

  pathToVanillaApp: string;
  private extraConfig: Configuration | undefined;
  private passthroughCache: Map<string, Stats> = new Map();
  private publicAssetURL: string | undefined;
  private extraThreadLoaderOptions: object | false | undefined;
  private extraBabelLoaderOptions: BabelLoaderOptions | undefined;

  constructor(
    pathToVanillaApp: string,
    private outputPath: string,
    private variants: Variant[],
    private consoleWrite: (msg: string) => void,
    options?: Options
  ) {
    if (!semverSatisfies(webpack.version, '^5.0.0')) {
      throw new Error(`@embroider/webpack requires webpack@^5.0.0, but found version ${webpack.version}`);
    }

    this.pathToVanillaApp = realpathSync(pathToVanillaApp);
    this.extraConfig = options?.webpackConfig;
    this.publicAssetURL = options?.publicAssetURL;
    this.extraThreadLoaderOptions = options?.threadLoaderOptions;
    this.extraBabelLoaderOptions = options?.babelLoaderOptions;
    warmUp(this.extraThreadLoaderOptions);
  }

  async build(): Promise<void> {
    let appInfo = this.examineApp();
    let webpack = this.getWebpack(appInfo);
    let stats = this.summarizeStats(await this.runWebpack(webpack));
    await this.writeFiles(stats, appInfo);
  }

  private examineApp(): AppInfo {
    let meta = getAppMeta(this.pathToVanillaApp);
    let templateCompiler = meta['template-compiler'];
    let rootURL = meta['root-url'];
    let babel = meta['babel'];
    let resolvableExtensions = meta['resolvable-extensions'];
    let entrypoints = [];
    let otherAssets = [];
    let publicAssetURL = this.publicAssetURL || rootURL;

    for (let relativePath of meta.assets) {
      if (/\.html/i.test(relativePath)) {
        entrypoints.push(new HTMLEntrypoint(this.pathToVanillaApp, rootURL, publicAssetURL, relativePath));
      } else {
        otherAssets.push(relativePath);
      }
    }

    return { entrypoints, otherAssets, templateCompiler, babel, rootURL, resolvableExtensions, publicAssetURL };
  }

  private configureWebpack(
    { entrypoints, templateCompiler, babel, resolvableExtensions, publicAssetURL }: AppInfo,
    variant: Variant
  ): Configuration {
    let entry: { [name: string]: string } = {};
    for (let entrypoint of entrypoints) {
      for (let moduleName of entrypoint.modules) {
        entry[moduleName] = './' + moduleName;
      }
    }

    let hbsOptions: HbsLoaderConfig = {
      templateCompilerFile: join(this.pathToVanillaApp, templateCompiler.filename),
      variant,
    };

    return {
      mode: variant.optimizeForProduction ? 'production' : 'development',
      context: this.pathToVanillaApp,
      entry,
      performance: {
        hints: false,
      },
      plugins: [
        //@ts-ignore
        new MiniCssExtractPlugin({
          filename: `chunk.[chunkhash].css`,
          chunkFilename: `chunk.[chunkhash].css`,
        }),
      ],
      node: false,
      module: {
        rules: [
          {
            test: /\.hbs$/,
            use: nonNullArray([
              maybeThreadLoader(templateCompiler.isParallelSafe, this.extraThreadLoaderOptions),
              {
                loader: require.resolve('@embroider/hbs-loader'),
                options: hbsOptions,
              },
            ]),
          },
          {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            test: require(join(this.pathToVanillaApp, babel.fileFilter)),
            use: nonNullArray([
              maybeThreadLoader(babel.isParallelSafe, this.extraThreadLoaderOptions),
              babelLoaderOptions(
                babel.majorVersion,
                variant,
                join(this.pathToVanillaApp, babel.filename),
                this.extraBabelLoaderOptions
              ),
            ]),
          },
          {
            test: isCSS,
            use: this.makeCSSRule(variant),
          },
        ],
      },
      output: {
        path: join(this.outputPath, 'assets'),
        filename: `chunk.[chunkhash].js`,
        chunkFilename: `chunk.[chunkhash].js`,
        publicPath: publicAssetURL + 'assets/',
      },
      optimization: {
        splitChunks: {
          chunks: 'all',
        },
      },
      resolve: {
        extensions: resolvableExtensions,
      },
      resolveLoader: {
        alias: {
          // these loaders are our dependencies, not the app's dependencies. I'm
          // not overriding the default loader resolution rules in case the app also
          // wants to control those.
          'thread-loader': require.resolve('thread-loader'),
          'babel-loader-8': require.resolve('@embroider/babel-loader-8'),
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
      return this.lastWebpack;
    }
    debug(`configuring webpack`);
    let config = this.variants.map(variant =>
      mergeWith({}, this.configureWebpack(appInfo, variant), this.extraConfig, appendArrays)
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
        content = readJsonSync(join(this.pathToVanillaApp, appRelativeSourceMapURL));
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

  private async writeFiles(stats: BundleSummary, { entrypoints, otherAssets }: AppInfo) {
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
            try {
              // zero here means we always attribute passthrough scripts to the
              // first build variant
              stats.entrypoints.set(
                script,
                new Map([[0, [await this.writeScript(script, written, this.variants[0])]]])
              );
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
            try {
              // zero here means we always attribute passthrough styles to the
              // first build variant
              stats.entrypoints.set(style, new Map([[0, [await this.writeStyle(style, written, this.variants[0])]]]));
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

    for (let entrypoint of entrypoints) {
      outputFileSync(join(this.outputPath, entrypoint.filename), entrypoint.render(stats), 'utf8');
      written.add(entrypoint.filename);
    }

    for (let relativePath of otherAssets) {
      if (!written.has(relativePath)) {
        await this.provideErrorContext(`while copying app's assets`, [], async () => {
          this.copyThrough(relativePath);
        });
      }
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

  private summarizeStats(multiStats: webpack.StatsCompilation): BundleSummary {
    let output: BundleSummary = {
      entrypoints: new Map(),
      lazyBundles: new Set(),
      variants: this.variants,
    };
    for (let [variantIndex, variant] of this.variants.entries()) {
      let { entrypoints, assets } = multiStats.children![variantIndex];

      // webpack's types are written rather loosely, implying that these two
      // properties may not be present. They really always are, as far as I can
      // tell, but we need to check here anyway to satisfy the type checker.
      if (!entrypoints) {
        throw new Error(`unexpected webpack output: no entrypoints`);
      }
      if (!assets) {
        throw new Error(`unexpected webpack output: no assets`);
      }

      let nonLazyAssets: Set<string> = new Set();
      for (let id of Object.keys(entrypoints)) {
        let { assets: entrypointAssets } = entrypoints[id];
        if (!entrypointAssets) {
          throw new Error(`unexpected webpack output: no entrypoint.assets`);
        }

        getOrCreate(output.entrypoints, id, () => new Map()).set(
          variantIndex,
          entrypointAssets.map(asset => 'assets/' + asset.name)
        );

        for (let asset of entrypointAssets) {
          nonLazyAssets.add(asset.name);
        }
      }
      if (variant.runtime !== 'browser') {
        // in the browser we don't need to worry about lazy assets (they will be
        // handled automatically by webpack as needed), but in any other runtime
        // we need the ability to preload them
        output.lazyBundles = new Set();
        for (let asset of assets) {
          if (!nonLazyAssets.has(asset.name)) {
            output.lazyBundles.add('assets/' + asset.name);
          }
        }
      }
    }
    return output;
  }

  private runWebpack(webpack: webpack.MultiCompiler): Promise<webpack.StatsCompilation> {
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
                color: Boolean(supportsColor.stdout),
              })
            );

            // the typing for MultiCompiler are all foobared.
            throw this.findBestError(flatMap((stats as any).stats, s => s.compilation.errors));
          }
          if (stats.hasWarnings() || process.env.VANILLA_VERBOSE) {
            this.consoleWrite(
              stats.toString({
                color: Boolean(supportsColor.stdout),
              })
            );
          }
          resolve(stats.toJson());
        } catch (e) {
          reject(e);
        }
      });
    });
  }

  private makeCSSRule(variant: Variant) {
    return [
      variant.optimizeForProduction
        ? MiniCssExtractPlugin.loader
        : { loader: 'style-loader', options: { injectType: 'styleTag' } },
      {
        loader: 'css-loader',
        options: {
          url: true,
          import: true,
          modules: 'global',
        },
      },
    ];
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
      error.message = error.message.replace(error.module.context, error.module.userRequest);

      // the tmpdir on OSX is horribly long and makes error messages hard to
      // read. This is doing the same as String.prototype.replaceAll, which node
      // doesn't have yet.
      error.message = error.message.split(tmpdir).join('$TMPDIR');
    }
    return error;
  }
};

const threadLoaderOptions = {
  // poolTimeout shuts down idle workers. The problem is, for
  // interactive rebuilds that means your startup cost for the
  // next rebuild is at least 600ms worse. So we insist on
  // keeping workers alive always.
  poolTimeout: Infinity,
};

function warmUp(extraOptions: object | false | undefined) {
  // We don't know if we'll be parallel-safe or not, but if the environment sets
  // JOBS to 1, or our extraOptions are set to false, we know we won't use
  // thread-loader, so no need to consume extra resources warming the worker
  // pool
  if (process.env.JOBS === '1' || extraOptions === false) {
    return null;
  }

  threadLoaderWarmup(Object.assign({}, threadLoaderOptions, extraOptions), [
    require.resolve('@embroider/hbs-loader'),
    require.resolve('@embroider/babel-loader-8'),
  ]);
}

function maybeThreadLoader(isParallelSafe: boolean, extraOptions: object | false | undefined) {
  if (process.env.JOBS === '1' || extraOptions === false || !isParallelSafe) {
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

function babelLoaderOptions(
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
    loader: 'babel-loader-8',
    options,
  };
}

export { Webpack };
