/*
  Most of the work this module does is putting an HTML-oriented facade around
  Webpack. That is, we want both the input and output to be primarily HTML files
  with proper spec semantics, and we use webpack to optimize the assets referred
  to by those files.

  While there are webpack plugins for handling HTML, none of them handle
  multiple HTML entrypoints and apply correct HTML semantics (for example,
  getting script vs module context correct).
*/

import { PackagerInstance, AppMeta, Packager, PackageCache } from '@embroider/core';
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
import { join, dirname, relative, resolve } from 'path';
import { JSDOM } from 'jsdom';
import isEqual from 'lodash/isEqual';
import mergeWith from 'lodash/mergeWith';
import partition from 'lodash/partition';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import Placeholder from './html-placeholder';
import makeDebug from 'debug';
import { format } from 'util';

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

    for (let tag of this.dom.window.document.querySelectorAll('link[rel="stylesheet"]')) {
      let styleTag = tag as HTMLLinkElement;
      let href = styleTag.href;
      if (!isAbsoluteURL(href)) {
        let url = this.relativeToApp(href);
        this.styles.push(url);
        let placeholder = new Placeholder(styleTag);
        let list = this.placeholders.get(url);
        if (list) {
          list.push(placeholder);
        } else {
          this.placeholders.set(url, [placeholder]);
        }
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
      let list = this.placeholders.get(src);
      if (list) {
        list.push(placeholder);
      } else {
        this.placeholders.set(src, [placeholder]);
      }
    }
  }

  private relativeToApp(relativeToHTML: string) {
    return resolve('/', this.dir, relativeToHTML).slice(1);
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
  externals: string[];
  templateCompiler: Function;
  babel: any;
  rootURL: string;
}

// AppInfos are equal if they result in the same webpack config.
function equalAppInfo(left: AppInfo, right: AppInfo): boolean {
  return (
    isEqual(left.externals, right.externals) &&
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
    private packageCache: PackageCache,
    options?: Options
  ) {
    this.pathToVanillaApp = realpathSync(pathToVanillaApp);
    this.extraConfig = options && options.webpackConfig;
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

    let externals = meta.externals || [];
    let templateCompiler = require(join(this.pathToVanillaApp, meta['template-compiler'])).compile;
    let rootURL = meta['root-url'];
    let babelConfigFile = meta['babel-config'];
    let babel;
    if (babelConfigFile) {
      babel = require(join(this.pathToVanillaApp, babelConfigFile));
    }
    return { entrypoints, otherAssets, externals, templateCompiler, babel, rootURL };
  }

  private mode = process.env.EMBER_ENV === 'production' ? 'production' : 'development';

  private configureWebpack({ entrypoints, externals, templateCompiler, babel }: AppInfo) {
    let entry: { [name: string]: string } = {};
    for (let entrypoint of entrypoints) {
      for (let moduleName of entrypoint.modules) {
        entry[moduleName] = './' + moduleName;
      }
    }

    let amdExternals: { [name: string]: string } = {};
    externals.forEach(external => {
      amdExternals[external] = `_embroider_("${external}")`;
    });

    return {
      mode: this.mode,
      context: this.pathToVanillaApp,
      entry,
      plugins: [new MiniCssExtractPlugin()],
      module: {
        rules: [
          {
            test: /\.hbs$/,
            use: [
              {
                loader: join(__dirname, './webpack-hbs-loader'),
                options: { templateCompiler },
              },
            ],
          },
          {
            test: this.shouldTranspileFile.bind(this),
            use: [
              process.env.JOBS === '1' || !babel.isParallelSafe ? null : 'thread-loader',
              {
                loader: 'babel-loader', // todo use babel.version to ensure the correct loader
                options: Object.assign({}, babel.config),
              },
            ].filter(Boolean),
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
      },
      optimization: {
        splitChunks: {
          chunks: 'all',
        },
      },
      externals: amdExternals,
      resolveLoader: {
        alias: {
          // these loaders are our dependencies, not the app's dependencies. I'm
          // not overriding the default loader resolution rules in case the app also
          // wants to control those.
          'thread-loader': require.resolve('thread-loader'),
          'babel-loader': require.resolve('@embroider/babel-loader-8'),
          'css-loader': require.resolve('css-loader'),
          'style-loader': require.resolve('style-loader'),
        },
      },
    };
  }

  private shouldTranspileFile(filename: string) {
    if (!isJS(filename)) {
      // quick exit for non JS extensions
      return false;
    }

    let owner = this.packageCache.ownerOfFile(filename);

    // Not owned by any NPM package? Weird, leave it alone.
    if (!owner) {
      return false;
    }

    // Owned by our app, so use babel
    if (owner.root === this.pathToVanillaApp) {
      return true;
    }

    // Lastly, use babel on ember addons, but not other arbitrary libraries. A
    // lot of them won't appreciate running through our AMD plugin, for example.
    // If you want to transpile some of them, you should make a different rule
    // from your own extension to the webpack config.
    return owner.packageJSON.keywords && owner.packageJSON.keywords.includes('ember-addon');
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
                  `warning: in ${
                    entrypoint.filename
                  } <script src="${script}"> does not exist on disk. If this is intentional, use a data-embroider-ignore attribute.`
                );
              } else {
                throw err;
              }
            }
          }
        }
        for (let style of entrypoint.styles) {
          if (!bundles.has(style)) {
            bundles.set(style, [await this.writeStyle(style, written)]);
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
      this.mode === 'development' ? 'style-loader' : MiniCssExtractPlugin.loader,
      {
        loader: 'css-loader',
        options: {
          url: true,
          import: true,
          modules: true,
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

function isJS(filename: string) {
  return /\.js$/i.test(filename);
}

interface StatSummary {
  entrypoints: Map<string, string[]>;
}

export { Webpack };
