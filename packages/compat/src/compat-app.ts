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
import Options, { optionsWithDefaults } from './options';
import resolve from 'resolve';
import { PortableTemplateCompilerConfig } from '@embroider/core/src/portable-plugin-config';
import { SetupCompilerParams } from '@embroider/core/src/template-compiler';

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
function setup(legacyEmberAppInstance: object, options: Required<Options> ) {
  let oldPackage = V1InstanceCache.forApp(legacyEmberAppInstance, options).app;

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
      root,
      oldPackage,
      configTree,
      analyzer,
      packageCache.getAddon(join(root, 'node_modules', '@embroider', 'synthesized-vendor')),
      options
    );
    return new AppBuilder<TreeNames>(root, packageCache.getApp(appSrcDir), adapter, options);
  };

  return { inTrees, instantiate };
}

class CompatAppAdapter implements AppAdapter<TreeNames> {
  constructor(
    private root: string,
    private oldPackage: V1App,
    private configTree: V1Config,
    private analyzer: DependencyAnalyzer,
    private synthVendor: Package,
    private options: Required<Options>,
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
    if (!this.oldPackage.shouldBuildTests) {
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
    let params: SetupCompilerParams = {
      plugins: this.oldPackage.htmlbarsPlugins,
      compilerPath: 'ember-source/vendor/ember/ember-template-compiler',
      resolverPath: '@embroider/compat/src/resolver',
      EmberENV: config,
      resolverParams: {
        root: this.root,
        modulePrefix: this.modulePrefix(),
        options: this.options
      }
    };

    return new PortableTemplateCompilerConfig(params, { basedir: this.root }).serialize();
  }

  babelConfig() {
    return this.oldPackage.babelConfig();
  }

  externals(): string[] {
    return this.analyzer.externals;
  }
}

export default class CompatApp extends BuildStage<TreeNames> {
  constructor(legacyEmberAppInstance: object, addons: Stage, options?: Options) {
    let { inTrees, instantiate } = setup(legacyEmberAppInstance, optionsWithDefaults(options));
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
