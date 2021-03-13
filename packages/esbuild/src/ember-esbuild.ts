/*
  Most of the work this module does is putting an HTML-oriented facade around
  Webpack. That is, we want both the input and output to be primarily HTML files
  with proper spec semantics, and we use webpack to optimize the assets referred
  to by those files.

  While there are webpack plugins for handling HTML, none of them handle
  multiple HTML entrypoints and apply correct HTML semantics (for example,
  getting script vs module context correct).
*/

import path from 'path';
import { getOrCreate, Variant, applyVariantToBabelConfig } from '@embroider/core';
import { PackagerInstance, AppMeta, Packager } from '@embroider/core';
import { readFileSync, outputFileSync, copySync, realpathSync, Stats, statSync, readJsonSync } from 'fs-extra';
import { join, dirname, relative, sep } from 'path';
import makeDebug from 'debug';
import { HTMLEntrypoint } from './html-entrypoint';

import * as esbuild from 'esbuild';

const debug = makeDebug('embroider:debug');

interface AppInfo {
  entrypoints: HTMLEntrypoint[];
  otherAssets: string[];
  templateCompiler: AppMeta['template-compiler'];
  babel: AppMeta['babel'];
  rootURL: AppMeta['root-url'];
  publicAssetURL: string;
  resolvableExtensions: AppMeta['resolvable-extensions'];
}

interface Options {
  // the base public URL for your assets in production. Use this when you want
  // to serve all your assets from a different origin (like a CDN) than your
  // actual index.html will be served on.
  //
  // This should be a URL ending in "/".
  publicAssetURL?: string;
}

// we want to ensure that not only does our instance conform to
// PackagerInstance, but our constructor conforms to Packager. So instead of
// just exporting our class directly, we export a const constructor of the
// correct type.
export const ESBuild: Packager<Options> = class ESBuild implements PackagerInstance {
  static annotation = '@embroider/esbuild';

  pathToVanillaApp: string;
  private passthroughCache: Map<string, Stats> = new Map();
  private publicAssetURL: string | undefined;

  constructor(
    pathToVanillaApp: string,
    private outputPath: string,
    private variants: Variant[],
    private consoleWrite: (msg: string) => void,
    options?: Options
  ) {
    this.pathToVanillaApp = realpathSync(pathToVanillaApp);
    this.publicAssetURL = options?.publicAssetURL;
  }

  async build(): Promise<void> {
    let appInfo = this.examineApp();
    let variantInfo = this.variants[0];

    console.error(appInfo, this.variants, this.outputPath);

    let scriptEntryPoints = appInfo.entrypoints.flatMap(html => {
      return html.modules.map(script => `${this.pathToVanillaApp}/${script}`);
    });

    await esbuild.build({
      entryPoints: scriptEntryPoints,
      loader: {
        '.ts': 'ts',
        '.js': 'js',
        /* TODO: '.hbs': 'hbs', */
        /* Maybe TODO?: '.html':'html' */
      },
      bundle: true,
      outdir: this.outputPath,
      format: 'esm',
      minify: variantInfo.optimizeForProduction,
      sourcemap: !variantInfo.optimizeForProduction,
      incremental: true,
      splitting: true,
      plugins: [
        /* TODO: hbs plugin */
      ],
      // tsconfig: path.join(addonFolder, 'tsconfig.json'),
    });
  }

  /**
   * Direct copy from ember-webpack
   *
   * should this be extracted?
   *
   */
  private examineApp(): AppInfo {
    let meta = JSON.parse(readFileSync(join(this.pathToVanillaApp, 'package.json'), 'utf8'))['ember-addon'] as AppMeta;
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
};
