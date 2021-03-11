/*
  Most of the work this module does is putting an HTML-oriented facade around
  Webpack. That is, we want both the input and output to be primarily HTML files
  with proper spec semantics, and we use webpack to optimize the assets referred
  to by those files.

  While there are webpack plugins for handling HTML, none of them handle
  multiple HTML entrypoints and apply correct HTML semantics (for example,
  getting script vs module context correct).
*/

import { getOrCreate, Variant, applyVariantToBabelConfig } from '@embroider/core';
import { PackagerInstance, AppMeta, Packager } from '@embroider/core';
import { readFileSync, outputFileSync, copySync, realpathSync, Stats, statSync, readJsonSync } from 'fs-extra';
import { join, dirname, relative, sep } from 'path';
import isEqual from 'lodash/isEqual';
import mergeWith from 'lodash/mergeWith';
import flatMap from 'lodash/flatMap';
import { format } from 'util';
import makeDebug from 'debug';
import { tmpdir } from 'os';
import { HTMLEntrypoint } from './html-entrypoint';
import { StatSummary } from './stat-summary';
import crypto from 'crypto';

import esbuild from 'esbuild';

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

// AppInfos are equal if they result in the same webpack config.
function equalAppInfo(left: AppInfo, right: AppInfo): boolean {
  return (
    isEqual(left.babel, right.babel) &&
    left.entrypoints.length === right.entrypoints.length &&
    left.entrypoints.every((e, index) => isEqual(e.modules, right.entrypoints[index].modules))
  );
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
    // let appInfo = this.examineApp();
    // let webpack = this.getWebpack(appInfo);
    // let stats = this.summarizeStats(await this.runWebpack(webpack));
    // await this.writeFiles(stats, appInfo);

    // TODO: fix the options
    await esbuild.build({
      loader: { '.ts': 'ts' },
      entryPoints: [entryPath],
      bundle: true,
      outfile: path.join(buildDir, `${name}.js`),
      format: 'esm',
      minify: isProduction,
      sourcemap: !isProduction,
      // incremental: true,
      tsconfig: path.join(addonFolder, 'tsconfig.json'),
    });
  }

};

