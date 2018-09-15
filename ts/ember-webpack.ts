import { Packager } from "ember-cli-vanilla";
import webpack from 'webpack';
import { readFileSync, writeFileSync } from 'fs';
import { join, basename, dirname, relative } from 'path';
import { JSDOM } from 'jsdom';
import isEqual from 'lodash/isEqual';
import mergeWith from 'lodash/mergeWith';
import partition from 'lodash/partition';

class Entrypoint {
  public dom: any;

  constructor(
    pathToVanillaApp: string,
    public filename: string,
  ){
    this.dom = new JSDOM(readFileSync(join(pathToVanillaApp, filename), 'utf8'));
  }

  get name() {
    return basename(this.filename, '.html');
  }

  // we deal in synchronous, relative scripts. All others we leave alone.
  get scriptTags() {
    let document = this.dom.window.document;
    return [...document.querySelectorAll('script')].filter(s => {
      return !s.hasAttribute('async') && !isAbsoluteURL(s.src);
    });
  }

  // makes relative to entrypoint
  private relative(p) {
    return './' + relative(dirname(this.filename), p);
  }

  get modules() {
    let [modules, scripts] = partition(this.scriptTags, tag => tag.type === 'module');
    // "script-loader!" is a webpack-ism. It's forcing our plain script tags to
    // be evaluated in script context, as opposed to module context.
    return scripts.map(script => `script-loader!${this.relative(script.src)}`).concat(
      modules.map(m => this.relative(m.src))
    );
  }
}

interface AppInfo {
  entrypoints: Entrypoint[];
  externals: string[];
  templateCompiler: Function;
  babelConfig: any;
}

class Webpack {
  constructor(
    private pathToVanillaApp: string,
    private outputPath: string,
    private consoleWrite: (msg: string) => void,
    private extraConfig: any
    ) {
  }

  private examineApp(): AppInfo {
    let packageJSON = JSON.parse(readFileSync(join(this.pathToVanillaApp, 'package.json'), 'utf8'));
    let entrypoints = packageJSON['ember-addon'].entrypoints.map(entrypoint => {
      return new Entrypoint(this.pathToVanillaApp, entrypoint);
    });
    let externals = packageJSON['ember-addon'].externals;
    let templateCompiler = require(join(this.pathToVanillaApp, packageJSON['ember-addon']['template-compiler']));
    let babelConfigFile = packageJSON['ember-addon']['babel-config'];
    let babelConfig;
    if (babelConfigFile) {
      babelConfig = require(join(this.pathToVanillaApp, babelConfigFile));
    }
    return { entrypoints, externals, templateCompiler, babelConfig };
  }

  private configureWebpack({ entrypoints, externals, templateCompiler, babelConfig }: AppInfo) {
    let entry = {};
    entrypoints.forEach(entrypoint => {
      entry[entrypoint.name] = entrypoint.modules;
    });

    let amdExternals = {};
    externals.forEach(external => {
      amdExternals[external] = `require("${external}")`;
    });

    return mergeWith({}, {
      mode: 'development', // todo
      context: this.pathToVanillaApp,
      entry,
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
            test: /\.js$/,
            use: [
              'thread-loader',
              {
                loader: 'babel-loader',
                options: Object.assign({}, babelConfig)
              }
            ]
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
          'babel-loader': require.resolve('babel-loader')
        }
      }
    }, this.extraConfig, appendArrays);
  }

  private lastConfig;
  private lastWebpack;

  private getWebpack(config) {
    if (this.lastWebpack && isEqual(config, this.lastConfig)) {
      return this.lastWebpack;
    }
    this.lastConfig = config;
    return this.lastWebpack = webpack(config);
  }

  async build(): Promise<void> {
    let appInfo = this.examineApp();
    let config = this.configureWebpack(appInfo);
    let webpack = this.getWebpack(config);
    let stats = this.summarizeStats(await this.runWebpack(webpack));
    this.writeHTML(stats, appInfo);
  }

  private writeHTML(stats, { entrypoints }: AppInfo) {
    // we're doing this ourselves because I haven't seen a webpack 4 HTML plugin
    // that handles multiple entrypoints correctly.
    for (let entrypoint of entrypoints) {
      let assets = stats.entrypoints.get(entrypoint.name);
      let scriptTags = entrypoint.scriptTags;
      let firstTag = scriptTags[0];
      for (let asset of assets) {
        let newScript = entrypoint.dom.window.document.createElement('script');
        newScript.src = `/assets/${asset}`; // todo adjust for rootURL
        firstTag.parentElement.insertBefore(newScript, firstTag);
      }
      scriptTags.forEach(tag => tag.remove());
      writeFileSync(join(this.outputPath, entrypoint.filename), entrypoint.dom.serialize(), 'utf8');
    }
  }

  private summarizeStats(stats) {
    let output = {
      entrypoints: new Map(),
      lazyAssets: [],
    };
    let nonLazyAssets = new Set();
    for (let id of Object.keys(stats.entrypoints)) {
      let entrypoint = stats.entrypoints[id];
      output.entrypoints.set(id, entrypoint.assets);
      entrypoint.assets.forEach(asset => nonLazyAssets.add(asset));
    }
    for (let asset of stats.assets) {
      if (!nonLazyAssets.has(asset.name)) {
        output.lazyAssets.push(asset.name);
      }
    }
    return output;
  }

  private runWebpack(webpack): Promise<any> {
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
            reject(new Error('webpack returned errors to ember-webpack'));
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
}

module.exports = function webpack(extraConfig={}) : Packager {
  let ConfiguredWebpack = class extends Webpack {
    constructor(
      pathToVanillaApp: string,
      outputPath: string,
      consoleWrite: (msg: string) => void
    ) {
      super(pathToVanillaApp, outputPath, consoleWrite, extraConfig);
    }
  };
  return ConfiguredWebpack;
};

function appendArrays(objValue, srcValue) {
  if (Array.isArray(objValue)) {
    return objValue.concat(srcValue);
  }
}

function isAbsoluteURL(url) {
  return /^(?:[a-z]+:)?\/\//i.test(url);
}
