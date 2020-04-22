/*
  Most of the work this module does is putting an HTML-oriented facade around
  Webpack. That is, we want both the input and output to be primarily HTML files
  with proper spec semantics, and we use webpack to optimize the assets referred
  to by those files.

  While there are webpack plugins for handling HTML, none of them handle
  multiple HTML entrypoints and apply correct HTML semantics (for example,
  getting script vs module context correct).
*/

import { PackagerInstance, AppMeta, Packager, getOrCreate } from '@embroider/core';
import webpack, { Configuration } from 'webpack';
import {
  readFileSync,
  writeFileSync,
  copySync,
  realpathSync,
  ensureDirSync,
  Stats,
  statSync,
  readJsonSync,
} from 'fs-extra';
import { join, dirname, relative, resolve, sep } from 'path';
import { JSDOM } from 'jsdom';
import isEqual from 'lodash/isEqual';
import mergeWith from 'lodash/mergeWith';
import partition from 'lodash/partition';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import Placeholder from './html-placeholder';
import makeDebug from 'debug';
import { format } from 'util';
import { tmpdir } from 'os';
import { warmup as threadLoaderWarmup } from 'thread-loader';

const debug = makeDebug('embroider:debug');

// This is a type-only import, so it gets compiled away. At runtime, we load
// terser lazily so it's only loaded for production builds that use it. Don't
// add any non-type-only imports here.
import { MinifyOptions } from 'terser';

class HTMLEntrypoint {
  private dom: JSDOM;
  private dir: string;
  private placeholders: Map<string, Placeholder[]> = new Map();
  modules: string[] = [];
  scripts: string[] = [];
  styles: string[] = [];

  constructor(private pathToVanillaApp: string, public filename: string) {
    this.dir = dirname(this.filename);
    this.dom = new JSDOM(readFileSync(join(this.pathToVanillaApp, this.filename), 'utf8'));

    for (let tag of this.handledStyles()) {
      let styleTag = tag as HTMLLinkElement;
      let href = styleTag.href;
      if (!isAbsoluteURL(href)) {
        let url = this.relativeToApp(href);
        this.styles.push(url);
        let placeholder = new Placeholder(styleTag);
        let list = getOrCreate(this.placeholders, url, () => []);
        list.push(placeholder);
      }
    }

    for (let scriptTag of this.handledScripts()) {
      // scriptTag.src is relative to this HTML file. Convert it to be relative
      // to the app.
      let src = this.relativeToApp(scriptTag.src);

      if (scriptTag.type === 'module') {
        this.modules.push(src);
      } else {
        this.scripts.push(src);
      }

      let placeholder = new Placeholder(scriptTag);
      let list = getOrCreate(this.placeholders, src, () => []);
      list.push(placeholder);
    }
  }

  private relativeToApp(relativeToHTML: string) {
    const resolvedPath = resolve('/', this.dir, relativeToHTML);
    const [, ...tail] = resolvedPath.split(sep);
    return tail.join(sep);
  }

  private handledScripts() {
    let scriptTags = [...this.dom.window.document.querySelectorAll('script')] as HTMLScriptElement[];
    let [ignoredScriptTags, handledScriptTags] = partition(scriptTags, scriptTag => {
      return !scriptTag.src || scriptTag.hasAttribute('data-embroider-ignore') || isAbsoluteURL(scriptTag.src);
    });
    for (let scriptTag of ignoredScriptTags) {
      scriptTag.removeAttribute('data-embroider-ignore');
    }
    return handledScriptTags;
  }

  private handledStyles() {
    let styleTags = [...this.dom.window.document.querySelectorAll('link[rel="stylesheet"]')] as HTMLLinkElement[];
    let [ignoredStyleTags, handledStyleTags] = partition(styleTags, styleTag => {
      return !styleTag.href || styleTag.hasAttribute('data-embroider-ignore') || isAbsoluteURL(styleTag.href);
    });
    for (let styleTag of ignoredStyleTags) {
      styleTag.removeAttribute('data-embroider-ignore');
    }
    return handledStyleTags;
  }

  render(bundles: Map<string, string[]>, rootURL: string): string {
    for (let [src, placeholders] of this.placeholders) {
      let matchingBundles = bundles.get(src);
      if (matchingBundles) {
        for (let placeholder of placeholders) {
          for (let matchingBundle of matchingBundles) {
            let src = rootURL + matchingBundle;
            placeholder.insertURL(src);
          }
        }
      } else {
        // no match means keep the original HTML content for this placeholder.
        // (If we really wanted it empty instead, there would be matchingBundles
        // and it would be an empty list.)
        for (let placeholder of placeholders) {
          placeholder.reset();
        }
      }
    }
    return this.dom.serialize();
  }
}

interface AppInfo {
  entrypoints: HTMLEntrypoint[];
  otherAssets: string[];
  templateCompiler: AppMeta['template-compiler'];
  babel: AppMeta['babel'];
  rootURL: AppMeta['root-url'];
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

interface Options {
  webpackConfig: Configuration;
}

// we want to ensure that not only does our instance conform to
// PackagerInstance, but our constructor conforms to Packager. So instead of
// just exporting our class directly, we export a const constructor of the
// correct type.
const Webpack: Packager<Options> = class Webpack implements PackagerInstance {
  static annotation = '@embroider/webpack';

  pathToVanillaApp: string;
  private extraConfig: Configuration | undefined;
  private passthroughCache: Map<string, Stats> = new Map();

  constructor(
    pathToVanillaApp: string,
    private outputPath: string,
    private consoleWrite: (msg: string) => void,
    options?: Options
  ) {
    this.pathToVanillaApp = realpathSync(pathToVanillaApp);
    this.extraConfig = options && options.webpackConfig;
    warmUp();
  }

  async build(): Promise<void> {
    let appInfo = this.examineApp();
    let webpack = this.getWebpack(appInfo);
    let stats = this.summarizeStats(await this.runWebpack(webpack));
    await this.writeFiles(stats, appInfo);
  }

  private examineApp(): AppInfo {
    let meta = JSON.parse(readFileSync(join(this.pathToVanillaApp, 'package.json'), 'utf8'))['ember-addon'] as AppMeta;

    let entrypoints = [];
    let otherAssets = [];

    for (let relativePath of meta.assets) {
      if (/\.html/i.test(relativePath)) {
        entrypoints.push(new HTMLEntrypoint(this.pathToVanillaApp, relativePath));
      } else {
        otherAssets.push(relativePath);
      }
    }

    let templateCompiler = meta['template-compiler'];
    let rootURL = meta['root-url'];
    let babel = meta['babel'];
    let resolvableExtensions = meta['resolvable-extensions'];

    return { entrypoints, otherAssets, templateCompiler, babel, rootURL, resolvableExtensions };
  }

  private mode: 'production' | 'development' = process.env.EMBER_ENV === 'production' ? 'production' : 'development';

  private configureWebpack({
    entrypoints,
    templateCompiler,
    babel,
    rootURL,
    resolvableExtensions,
  }: AppInfo): Configuration {
    let entry: { [name: string]: string } = {};
    for (let entrypoint of entrypoints) {
      for (let moduleName of entrypoint.modules) {
        entry[moduleName] = './' + moduleName;
      }
    }

    return {
      mode: this.mode,
      context: this.pathToVanillaApp,
      entry,
      performance: {
        hints: false,
      },
      plugins: [new MiniCssExtractPlugin()],
      node: false,
      module: {
        rules: [
          {
            test: /\.hbs$/,
            use: nonNullArray([
              maybeThreadLoader(templateCompiler.isParallelSafe),
              {
                loader: join(__dirname, './webpack-hbs-loader'),
                options: {
                  templateCompilerFile: join(this.pathToVanillaApp, templateCompiler.filename),
                },
              },
            ]),
          },
          {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            test: require(join(this.pathToVanillaApp, babel.fileFilter)),
            use: nonNullArray([
              maybeThreadLoader(babel.isParallelSafe),
              {
                loader: babel.majorVersion === 6 ? 'babel-loader-7' : 'babel-loader-8',
                // eslint-disable-next-line @typescript-eslint/no-require-imports
                options: Object.assign({}, require(join(this.pathToVanillaApp, babel.filename)), {
                  // all stage3 packagers should keep persistent caches under
                  // `join(tmpdir(), 'embroider')`. An important reason is that
                  // they should have exactly the same lifetime as some of
                  // embroider's own caches.
                  cacheDirectory: join(tmpdir(), 'embroider', 'webpack-babel-loader'),
                }),
              },
            ]),
          },
          {
            test: isCSS,
            use: this.makeCSSRule(),
          },
        ],
      },
      output: {
        path: join(this.outputPath, 'assets'),
        filename: `chunk.[chunkhash].js`,
        chunkFilename: `chunk.[chunkhash].js`,
        publicPath: rootURL + 'assets/',
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
          'babel-loader-8': require.resolve('babel-loader'),
          'babel-loader-7': require.resolve('@embroider/babel-loader-7'),
          'css-loader': require.resolve('css-loader'),
          'style-loader': require.resolve('style-loader'),
        },
      },
    };
  }

  private lastAppInfo: AppInfo | undefined;
  private lastWebpack: webpack.Compiler | undefined;

  private getWebpack(appInfo: AppInfo) {
    if (this.lastWebpack && this.lastAppInfo && equalAppInfo(appInfo, this.lastAppInfo)) {
      debug(`reusing webpack config`);
      return this.lastWebpack;
    }
    debug(`configuring webpack`);
    let config = mergeWith({}, this.configureWebpack(appInfo), this.extraConfig, appendArrays);
    this.lastAppInfo = appInfo;
    return (this.lastWebpack = webpack(config));
  }

  private async writeScript(script: string, written: Set<string>) {
    if (this.mode !== 'production') {
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
    let { code: outCode, map: outMap } = Terser.default.minify(inCode, terserOpts);
    writeFileSync(join(this.outputPath, script), outCode);
    written.add(script);
    if (appRelativeSourceMapURL && outMap) {
      writeFileSync(join(this.outputPath, appRelativeSourceMapURL), outMap);
      written.add(appRelativeSourceMapURL);
    }
    return script;
  }

  private async writeStyle(style: string, written: Set<string>) {
    this.copyThrough(style);
    written.add(style);
    return style;
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

  private async writeFiles(stats: StatSummary, { entrypoints, otherAssets, rootURL }: AppInfo) {
    // we're doing this ourselves because I haven't seen a webpack 4 HTML plugin
    // that handles multiple HTML entrypoints correctly.

    let written: Set<string> = new Set();

    // scripts (as opposed to modules) and stylesheets (as opposed to CSS
    // modules that are imported from JS modules) get passed through without
    // going through webpack.
    let bundles = new Map(stats.entrypoints);
    for (let entrypoint of entrypoints) {
      await this.provideErrorContext('needed by %s', [entrypoint.filename], async () => {
        for (let script of entrypoint.scripts) {
          if (!bundles.has(script)) {
            try {
              bundles.set(script, [await this.writeScript(script, written)]);
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
          if (!bundles.has(style)) {
            try {
              bundles.set(style, [await this.writeStyle(style, written)]);
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
      ensureDirSync(dirname(join(this.outputPath, entrypoint.filename)));
      writeFileSync(join(this.outputPath, entrypoint.filename), entrypoint.render(bundles, rootURL), 'utf8');
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

  private summarizeStats(stats: any): StatSummary {
    let output: { entrypoints: Map<string, string[]> } = {
      entrypoints: new Map(),
    };
    for (let id of Object.keys(stats.entrypoints)) {
      let entrypoint = stats.entrypoints[id];
      let assets = (entrypoint.assets as string[]).map(asset => 'assets/' + asset);
      output.entrypoints.set(id, assets);
    }
    return output;
  }

  private runWebpack(webpack: webpack.Compiler): Promise<any> {
    return new Promise((resolve, reject) => {
      webpack.run((err, stats) => {
        if (err) {
          this.consoleWrite(stats.toString());
          reject(err);
          return;
        }
        if (stats.hasErrors()) {
          reject(this.findBestError(stats.compilation.errors));
          return;
        }
        if (stats.hasWarnings() || process.env.VANILLA_VERBOSE) {
          this.consoleWrite(stats.toString());
        }
        resolve(stats.toJson());
      });
    });
  }

  private makeCSSRule() {
    return [
      this.mode === 'development'
        ? { loader: 'style-loader', options: { injectType: 'styleTag' } }
        : MiniCssExtractPlugin.loader,
      {
        loader: 'css-loader',
        options: {
          url: true,
          import: true,
          //modules: true,
          modules: 'global',
        },
      },
    ];
  }

  private findBestError(errors: any[]) {
    for (let error of errors) {
      let file;
      while (error) {
        if (error.module && error.module.rawRequest) {
          file = relative(this.pathToVanillaApp, error.module.userRequest);
        }
        if (error.codeFrame || error.loc) {
          // this looks like a good error. Let's also make sure any location info
          // is copied onto the root of the error because that's where broccoli
          // looks for it.
          if (!error.file) {
            error.file = file || (error.loc ? error.loc.file : null) || (error.location ? error.location.file : null);
          }
          if (error.line == null) {
            error.line = (error.loc ? error.loc.line : null) || (error.location ? error.location.line : null);
          }
          return error;
        }
        error = error.error;
      }
    }
    return errors[0];
  }
};

const threadLoaderOptions = {
  // poolTimeout shuts down idle workers. The problem is, for
  // interactive rebuilds that means your startup cost for the
  // next rebuild is at least 600ms worse. So we insist on
  // keeping workers alive always.
  poolTimeout: Infinity,
};

function warmUp() {
  threadLoaderWarmup(threadLoaderOptions, [
    join(__dirname, './webpack-hbs-loader'),
    require.resolve('babel-loader'),
    require.resolve('@embroider/babel-loader-7'),
  ]);
}

function maybeThreadLoader(isParallelSafe: boolean) {
  if (process.env.JOBS === '1' || !isParallelSafe) {
    return null;
  }

  return {
    loader: 'thread-loader',
    options: threadLoaderOptions,
  };
}

function appendArrays(objValue: any, srcValue: any) {
  if (Array.isArray(objValue)) {
    return objValue.concat(srcValue);
  }
}

function isAbsoluteURL(url: string) {
  return /^(?:[a-z]+:)?\/\//i.test(url);
}

function isCSS(filename: string) {
  return /\.css$/i.test(filename);
}

interface StatSummary {
  entrypoints: Map<string, string[]>;
}

// typescript doesn't understand that regular use of array.filter(Boolean) does
// this.
function nonNullArray<T>(array: T[]): NonNullable<T>[] {
  return array.filter(Boolean) as NonNullable<T>[];
}

export { Webpack };
