import { Tree } from 'broccoli-plugin';
import mergeTrees from 'broccoli-merge-trees';
import {
  Stage,
  PackageCache,
  OutputPaths,
  BuildStage,
  Asset,
  EmberAsset,
  AppAdapter,
  AppBuilder,
  EmberENV,
  Package
} from '@embroider/core';
import V1InstanceCache from './v1-instance-cache';
import V1App from './v1-app';
import walkSync from 'walk-sync';
import { join } from 'path';
import { JSDOM } from 'jsdom';
import DependencyAnalyzer from './dependency-analyzer';
import { V1Config } from './v1-config';
import { statSync } from 'fs';

export class Options {
  extraPublicTrees?: Tree[];
}

interface TreeNames {
  appJS: Tree;
  analyzer: Tree;
  htmlTree: Tree;
  publicTree: Tree;
  configTree: Tree;
}

// This runs at broccoli-pipeline-construction time, whereas our actual
// CompatAppAdapter instance only becomes available during tree-building
// time.
function setup(legacyEmberAppInstance: object, options?: Options ) {
  let oldPackage = V1InstanceCache.forApp(legacyEmberAppInstance).app;

  let { analyzer, appJS } = oldPackage.processAppJS();
  let htmlTree = oldPackage.htmlTree;
  let publicTree = oldPackage.publicTree;
  let configTree = oldPackage.config;

  if (options && options.extraPublicTrees) {
    publicTree = mergeTrees([publicTree, ...options.extraPublicTrees]);
  }

  let inTrees = {
    appJS,
    analyzer,
    htmlTree,
    publicTree,
    configTree,
  };

  let instantiate = async (root: string, appSrcDir: string, packageCache: PackageCache) => {
    let adapter = new CompatAppAdapter(
      oldPackage,
      configTree,
      analyzer,
      packageCache.getAddon(join(root, 'node_modules', '@embroider', 'synthesized-vendor'))
    );
    return new AppBuilder<TreeNames>(root, packageCache.getApp(appSrcDir), adapter);
  };

  return { inTrees, instantiate };
}

class CompatAppAdapter implements AppAdapter<TreeNames> {
  constructor(
    private oldPackage: V1App,
    private configTree: V1Config,
    private analyzer: DependencyAnalyzer,
    private synthVendor: Package,
  ) {}

  appJSSrcDir(treePaths: OutputPaths<TreeNames>) {
    return treePaths.appJS;
  }

  assets(treePaths: OutputPaths<TreeNames>): Asset[] {
    // Everything in our traditional public tree is an on-disk asset
    let assets = walkSync.entries(treePaths.publicTree, {
      directories: false,
    }).map((entry): Asset => ({
      kind: 'on-disk',
      relativePath: entry.relativePath,
      sourcePath: entry.fullPath,
      mtime: entry.mtime as unknown as number, // https://github.com/joliss/node-walk-sync/pull/38
      size: entry.size
    }));

    for (let asset of this.emberEntrypoints(treePaths.htmlTree)) {
      assets.push(asset);
    }

    return assets;
  }

  private * emberEntrypoints(htmlTreePath: string): IterableIterator<Asset> {
    let classicEntrypoints = [
      { entrypoint: 'index.html', includeTests: false },
      { entrypoint: 'tests/index.html', includeTests: true },
    ];
    if (!this.shouldBuildTests) {
      classicEntrypoints.pop();
    }
    for (let { entrypoint, includeTests } of classicEntrypoints) {
      let sourcePath = join(htmlTreePath, entrypoint);
      let stats = statSync(sourcePath);
      let asset: EmberAsset = {
        kind: 'ember',
        relativePath: entrypoint,
        includeTests,
        sourcePath,
        mtime: stats.mtime.getTime(),
        size: stats.size,
        prepare: (dom: JSDOM) => {
          let scripts = [...dom.window.document.querySelectorAll("script")];
          let styles = [
            ...dom.window.document.querySelectorAll('link[rel="stylesheet"]'),
          ] as HTMLLinkElement[];

          // these are scripts that are served up by middleware in ember-cli
          // that should not be considered by the final stage packager.
          // todo: probably we should make this extensible.
          let ignored = ['/ember-cli-live-reload.js', '/testem.js'];
          for (let script of scripts) {
            if (ignored.includes(script.src)) {
              script.setAttribute('data-embroider-ignore', '');
            }
          }

          return {
            javascript: definitelyReplace(dom, this.oldPackage.findAppScript(scripts), 'app javascript', entrypoint),
            styles: definitelyReplace(dom, this.oldPackage.findAppStyles(styles), 'app styles', entrypoint),
            implicitScripts: definitelyReplace(dom, this.oldPackage.findVendorScript(scripts), 'vendor javascript', entrypoint),
            implicitStyles: definitelyReplace(dom, this.oldPackage.findVendorStyles(styles), 'vendor styles', entrypoint),
            testJavascript: maybeReplace(dom, this.oldPackage.findTestScript(scripts)),
            implicitTestScripts: maybeReplace(dom, this.oldPackage.findTestSupportScript(scripts)),
            implicitTestStyles: maybeReplace(dom, this.oldPackage.findTestSupportStyles(styles)),
          };
        }
      };
      yield asset;
    }
  }

  autoRun(): boolean {
    return this.oldPackage.autoRun;
  }

  mainModule(): string {
    return this.oldPackage.isModuleUnification ? "src/main" : "app";
  }

  mainModuleConfig(): unknown {
    return this.configTree.readConfig().APP;
  }

  emberENV(): EmberENV {
    return this.configTree.readConfig().EmberENV;
  }

  modulePrefix(): string {
    return this.configTree.readConfig().modulePrefix;
  }

  extraDependencies(): Package[] {
    return [this.synthVendor];
  }

  templateCompilerSource(config: EmberENV) {
    let plugins = this.oldPackage.htmlbarsPlugins;
    (global as any).__embroiderHtmlbarsPlugins__ = plugins;
    return `
    var compiler = require('ember-source/vendor/ember/ember-template-compiler');
    var setupCompiler = require('@embroider/core/src/template-compiler').default;
    var EmberENV = ${JSON.stringify(config)};
    var plugins = global.__embroiderHtmlbarsPlugins__;
    if (!plugins) {
      throw new Error('You must run your final stage packager in the same process as CompatApp, because there are unserializable AST plugins');
    }
    module.exports = setupCompiler(compiler, EmberENV, plugins);
    `;
  }

  babelConfig(finalRoot: string) {
    return this.oldPackage.babelConfig(finalRoot);
  }

  externals(): string[] {
    return this.analyzer.externals;
  }

  // todo
  private shouldBuildTests = true;

}

export default class CompatApp extends BuildStage<TreeNames> {
  constructor(legacyEmberAppInstance: object, addons: Stage, options?: Options) {
    let { inTrees, instantiate } = setup(legacyEmberAppInstance, options);
    super(addons, inTrees, '@embroider/compat/app', instantiate);
  }
}

function maybeReplace(dom: JSDOM, element: Element | undefined): Node | undefined {
  if (element) {
    return definitelyReplace(dom, element, "", "");
  }
}

function definitelyReplace(dom: JSDOM, element: Element | undefined, description: string, file: string): Node {
  if (!element) {
    throw new Error(`could not find ${description} in ${file}`);
  }
  let placeholder = dom.window.document.createTextNode('');
  element.replaceWith(placeholder);
  return placeholder;
}
