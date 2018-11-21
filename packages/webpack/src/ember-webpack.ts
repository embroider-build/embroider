import { PackagerInstance, AppMeta } from "@embroider/core";
import webpack, { Configuration } from 'webpack';
import { readFileSync, writeFileSync, copySync, realpathSync, ensureDirSync } from 'fs-extra';
import { join, dirname, resolve } from 'path';
import { JSDOM } from 'jsdom';
import isEqual from 'lodash/isEqual';
import mergeWith from 'lodash/mergeWith';
import partition from 'lodash/partition';
import { Memoize } from 'typescript-memoize';
import PackageOwners from "./package-owners";
import MiniCssExtractPlugin from "mini-css-extract-plugin";

class Entrypoint {
  constructor(private pathToVanillaApp: string, public filename: string){}

  get isHTML() {
    return /\.html$/i.test(this.filename);
  }

  get absoluteFilename() {
    return join(this.pathToVanillaApp, this.filename);
  }

  @Memoize()
  get dom() {
    return new JSDOM(readFileSync(this.absoluteFilename, 'utf8'));
  }

  get name() {
    return this.filename;
  }

  // we deal in synchronous, relative scripts. All others we leave alone.
  @Memoize()
  get scriptTags() {
    return [...this.dom.window.document.querySelectorAll('script')]
      .filter(s => s.hasAttribute('src') && !s.hasAttribute('async') && !isAbsoluteURL(s.src));
  }

  @Memoize()
  get styleLinks() {
    return ([...this.dom.window.document.querySelectorAll('link[rel="stylesheet"]')] as HTMLLinkElement[])
      .filter(s => !isAbsoluteURL(s.href));
  }

  @Memoize()
  private partitionedSources() {
    let [modules, scripts] = partition(this.scriptTags, tag => tag.type === 'module');
    return {
      modules: modules.map(t => this.resolvePath(t.src)),
      scripts: scripts.map(t=> this.resolvePath(t.src)),
      styles: this.styleLinks.map(link => this.resolvePath(link.href))
    };
  }

  get modules() {
    return this.partitionedSources().modules;
  }

  get scripts() {
    return this.partitionedSources().scripts;
  }

  get styles() {
    return this.partitionedSources().styles;
  }

  private resolvePath(p: string) {
    if (p[0] === '/') {
      // this path is relative to the app root
      return resolve(this.pathToVanillaApp, p.slice(1));
    } else {
      // the path is relative to the entrypoint file, which is relative to the
      // app root.
      return resolve(this.pathToVanillaApp, dirname(this.filename), p);
    }
  }

  @Memoize()
  get specifiers() {
    // "script-loader!" is a webpack-ism. It's forcing our plain script tags to
    // be evaluated in script context, as opposed to module context.
    return this.scripts.map(script => `script-loader!${script}`)
    .concat(this.modules)
    .concat(this.styles);
  }
}

interface AppInfo {
  entrypoints: Entrypoint[];
  externals: string[];
  templateCompiler: Function;
  babelConfig: any;
}

interface Options {
  webpackConfig: Configuration;
}

export class Webpack implements PackagerInstance {
  pathToVanillaApp: string;
  private extraConfig: Configuration | undefined;

  constructor(
    pathToVanillaApp: string,
    private outputPath: string,
    private consoleWrite: (msg: string) => void,
    options?: Options
  ) {
    this.pathToVanillaApp = realpathSync(pathToVanillaApp);
    this.extraConfig = options && options.webpackConfig;
  }

  private packageOwners: PackageOwners = new PackageOwners();

  private examineApp(): AppInfo {
    let meta = JSON.parse(readFileSync(join(this.pathToVanillaApp, 'package.json'), 'utf8'))['ember-addon'] as AppMeta;
    let entrypoints = meta.entrypoints.map(entrypoint => {
      return new Entrypoint(this.pathToVanillaApp, entrypoint);
    });
    let externals = meta.externals || [];
    let templateCompiler = require(join(this.pathToVanillaApp, meta['template-compiler']));
    let babelConfigFile = meta['babel-config'];
    let babelConfig;
    if (babelConfigFile) {
      babelConfig = require(join(this.pathToVanillaApp, babelConfigFile));
    }
    return { entrypoints, externals, templateCompiler, babelConfig };
  }

  // todo
  private mode = 'development';

  private configureWebpack({ entrypoints, externals, templateCompiler, babelConfig }: AppInfo) {
    // keep track of known scripts (as opposed to modules), as those are
    // conventionally not transpiled by babel (they are the old `vendor` assets
    // that were simply concatenated).
    let scripts = new Set();

    // keep track of files added via <link rel="stylesheet">, because those are
    // not parsed and traversed, whereas CSS files that are `import`ed from
    // Javascript are. This is analogous to the script vs module distinction for
    // Javascript.
    let stylesheets = new Set();

    let entry: { [name: string]: string[] } = {};
    entrypoints.forEach(entrypoint => {
      if (entrypoint.isHTML && entrypoint.specifiers.length > 0) {
        entry[entrypoint.name] = entrypoint.specifiers;
        entrypoint.scripts.forEach(script => scripts.add(script));
        entrypoint.styles.forEach(stylesheet => stylesheets.add(stylesheet));
      }
    });

    let amdExternals: { [name: string]: string } = {};
    externals.forEach(external => {
      amdExternals[external] = `_vanilla_("${external}")`;
    });

    return {
      mode: this.mode,
      context: this.pathToVanillaApp,
      entry,
      plugins: [
        // this is needed for script-loader to have sourcemaps. It's a backward
        // compatibility thing, presumably script-loader will eventually update
        // to the modern webpack way of taking these options.
        new webpack.LoaderOptionsPlugin({
          debug: this.mode === 'development'
        }),
        new MiniCssExtractPlugin()
      ],
      module: {
        rules: [
          {
            test: /\.hbs$/,
            use: [
              {
                loader: join(__dirname, './webpack-hbs-loader'),
                options: { templateCompiler }
              }
            ]
          },
          {
            test: this.shouldTranspileFile.bind(this, scripts),
            use: [
              process.env.JOBS === '1' ? null : 'thread-loader',
              {
                loader: 'babel-loader',
                options: Object.assign({}, babelConfig)
              }
            ].filter(Boolean)
          },
          {
            test: this.isCSSModule.bind(this, stylesheets),
            use: this.makeCSSRule(true)
          },
          {
            test: this.isStylesheet.bind(this, stylesheets),
            use: this.makeCSSRule(false)
          }
        ]
      },
      output: {
        path: join(this.outputPath, 'assets'),
        filename: `chunk.[chunkhash].js`,
        chunkFilename: `chunk.[chunkhash].js`,
      },
      optimization: {
        splitChunks: {
          chunks: 'all'
        }
      },
      externals: amdExternals,
      resolveLoader: {
        alias: {
          // these loaders are our dependencies, not the app's dependencies. I'm
          // not overriding the default loader resolution rules in case the app also
          // wants to control those.
          'script-loader': require.resolve('script-loader'),
          'thread-loader': require.resolve('thread-loader'),
          'babel-loader': require.resolve('babel-loader'),
          'css-loader': require.resolve('css-loader'),
          'style-loader': require.resolve('style-loader')
        }
      }
    };
  }

  private isCSSModule(stylesheets: Set<string>, filename: string) {
    return isCSS(filename) && !stylesheets.has(filename);
  }

  private isStylesheet(stylesheets: Set<string>, filename: string) {
    return isCSS(filename) && stylesheets.has(filename);
  }

  private shouldTranspileFile(scripts: Set<string>, filename: string) {
    if (!isJS(filename)) {
      // quick exit for non JS extensions
      return false;
    }

    if (scripts.has(filename)) {
      // our vendored scripts don't get babel
      return false;
    }

    let owner = this.packageOwners.lookup(filename);

    // Not owned by any NPM package? Weird, leave it alone.
    if (!owner) { return false; }

    // Owned by our app, so use babel
    if (owner.root === this.pathToVanillaApp) {
      return true;
    }

    // Lastly, use babel on ember addons, but not other arbitrary libraries. A
    // lot of them won't appreciate running through our AMD plugin, for example.
    // If you want to transpile some of them, you should make a different rule
    // from your own extension to the webpack config.
    return owner.packageJSON.keywords &&
      owner.packageJSON.keywords.includes('ember-addon');
  }

  private lastConfig: Configuration | undefined;
  private lastWebpack: webpack.Compiler | undefined;

  private getWebpack(config: Configuration) {
    if (this.lastWebpack && isEqual(config, this.lastConfig)) {
      return this.lastWebpack;
    }
    this.lastConfig = config;
    return this.lastWebpack = webpack(config);
  }

  async build(): Promise<void> {
    let appInfo = this.examineApp();
    let config = mergeWith({}, this.configureWebpack(appInfo), this.extraConfig, appendArrays);
    let webpack = this.getWebpack(config);
    let stats = this.summarizeStats(await this.runWebpack(webpack));
    this.writeFiles(stats, appInfo);
  }

  private writeFiles(stats: StatSummary, { entrypoints }: AppInfo) {
    // we're doing this ourselves because I haven't seen a webpack 4 HTML plugin
    // that handles multiple entrypoints correctly.
    for (let entrypoint of entrypoints) {
      let assets = stats.entrypoints.get(entrypoint.name);
      if (assets) {
        // this branch handles html entrypoints that we passed through webpack
        for (let asset of assets) {
          if (isJS(asset)) {
            let firstTag = entrypoint.scriptTags[0] as InDOMHTMLElement;
            // this conditional is here because if there were no scripts in the
            // input, we're not about to add some in the output, even though
            // webpack sometimes does funny things like adding empty script
            // chunks just because we have some CSS.
            if (firstTag) {
              let newScript = entrypoint.dom.window.document.createElement('script');
              newScript.src = `/assets/${asset}`; // todo adjust for rootURL
              firstTag.parentElement.insertBefore(newScript, firstTag);
            }
          } else if (isCSS(asset)) {
            let firstLink = entrypoint.styleLinks[0] as InDOMHTMLElement;
            if (firstLink) {
              let newLink = entrypoint.dom.window.document.createElement('link');
              newLink.href = `/assets/${asset}`; // todo adjust for rootURL
              newLink.rel = 'stylesheet';
              firstLink.parentElement.insertBefore(newLink, firstLink);
            }
          }
        }
        entrypoint.scriptTags.forEach(tag => tag.remove());
        entrypoint.styleLinks.forEach(tag => tag.remove());
        ensureDirSync(dirname(join(this.outputPath, entrypoint.filename)));
        writeFileSync(join(this.outputPath, entrypoint.filename), entrypoint.dom.serialize(), 'utf8');
      } else {
        // this branch handles other assets that we are just passing through
        copySync(entrypoint.absoluteFilename, join(this.outputPath, entrypoint.filename));
      }
    }
  }

  private summarizeStats(stats: any): StatSummary {
    let output: { lazyAssets: string[], entrypoints: Map<string, string[]> } = {
      entrypoints: new Map(),
      lazyAssets: [],
    };
    let nonLazyAssets = new Set();
    for (let id of Object.keys(stats.entrypoints)) {
      let entrypoint = stats.entrypoints[id];
      output.entrypoints.set(id, entrypoint.assets);
      (entrypoint.assets as string[]).forEach(asset => nonLazyAssets.add(asset));
    }
    for (let asset of stats.assets) {
      if (!nonLazyAssets.has(asset.name)) {
        output.lazyAssets.push(asset.name);
      }
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
          let templateError = stats.compilation.errors.find(e => e.error && e.error.type === 'Template Compiler Error');
          if (templateError) {
            reject(templateError.error);
          } else {
            this.consoleWrite(stats.toString());
            reject(new Error('webpack returned errors to @embroider/webpack'));
          }
          return;
        }
        if (stats.hasWarnings() || process.env.VANILLA_VERBOSE) {
          this.consoleWrite(stats.toString());
        }
        resolve(stats.toJson());
      });
    });
  }

  private makeCSSRule(moduleMode: boolean) {
    return [
      moduleMode && this.mode === 'development' ? 'style-loader' : MiniCssExtractPlugin.loader,
      {
        loader: 'css-loader',
        options: {
          url: moduleMode,
          import: moduleMode,
          modules: moduleMode
        }
      }
    ];
  }

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

function isJS(filename: string) {
  return /\.js$/i.test(filename);
}

interface StatSummary {
  lazyAssets: string[];
  entrypoints: Map<string, string[]>;
}

interface InDOMHTMLElement extends HTMLElement {
  parentElement: HTMLElement;
}
