import { Packager } from "ember-cli-vanilla";
import webpack from 'webpack';
import { readFileSync } from 'fs';
import { join, basename } from 'path';
import { JSDOM } from 'jsdom';
import isEqual from 'lodash/isEqual';
import mergeWith from 'lodash/mergeWith';

class Webpack {
  constructor(
    private pathToVanillaApp: string,
    private outputPath: string,
    private consoleWrite: (msg: string) => void,
    private extraConfig: any
    ) {
  }

  private examineApp() {
    let packageJSON = JSON.parse(readFileSync(join(this.pathToVanillaApp, 'package.json'), 'utf8'));
    let entrypoints = packageJSON['ember-addon'].entrypoints.map(entrypoint => {
      let document = new JSDOM(readFileSync(join(this.pathToVanillaApp, entrypoint), 'utf8')).window.document;
      let scripts = [...document.querySelectorAll('script')].filter(s => {
        return !s.hasAttribute('async') && !isAbsoluteURL(s.src);
      }).map(s => s.src.replace(/^\//, this.pathToVanillaApp + '/'));
      return { name: entrypoint, scripts };
    });
    let externals = packageJSON['ember-addon'].externals;
    let templateCompiler = require(join(this.pathToVanillaApp, packageJSON['ember-addon']['template-compiler']));
    return { entrypoints, externals, templateCompiler };
  }

  private configureWebpack({ entrypoints, externals, templateCompiler }) {

    let entry = {};
    entrypoints.forEach(entrypoint => {
      entry[basename(entrypoint.name, '.html')] = entrypoint.scripts.slice();
    });

    let amdExternals = {};
    externals.forEach(external => {
      amdExternals[external] = `require("${externals}")`;
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
          }
        ]
      },
      output: {
        path: this.outputPath,
        filename: `chunk.[chunkhash].js`,
        chunkFilename: `chunk.[chunkhash].js`,
      },
      optimization: {
        splitChunks: {
          chunks: 'all'
        }
      },
      externals: amdExternals
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
    await this.runWebpack(webpack);
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
