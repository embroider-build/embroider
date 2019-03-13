import V1Package from "./v1-package";
import { Memoize } from 'typescript-memoize';
import { dirname } from 'path';
import { sync as pkgUpSync }  from 'pkg-up';
import { join } from 'path';
import { existsSync, pathExistsSync } from 'fs-extra';
import resolvePackagePath from 'resolve-package-path';
import Funnel, { Options as FunnelOptions } from 'broccoli-funnel';
import { UnwatchedDir } from 'broccoli-source';
import DependencyAnalyzer from './dependency-analyzer';
import RewritePackageJSON from './rewrite-package-json';
import { todo, unsupported } from '@embroider/core/src/messages';
import MultiFunnel from './multi-funnel';
import ImportParser from './import-parser';
import { Tree } from "broccoli-plugin";
import mergeTrees from 'broccoli-merge-trees';
import semver from 'semver';
import Snitch from './snitch';
import rewriteAddonTestSupport from "./rewrite-addon-test-support";
import { mergeWithAppend } from './merges';
import { Package, PackageCache, AddonMeta } from "@embroider/core";
import Options from "./options";
import walkSync from 'walk-sync';
import AddToTree from "./add-to-tree";
import ASTPrecompiler from './ast-precompiler';
import { Options as HTMLBarsOptions } from 'ember-cli-htmlbars';
import resolve from "resolve";
import { isEmbroiderMacrosPlugin } from "@embroider/macros";
import { TransformOptions, PluginItem } from "@babel/core";
import { isInlinePrecompilePlugin } from "./inline-apply-ast-transforms";

const stockTreeNames = Object.freeze([
  'addon',
  'addon-styles',
  'styles',
  'addon-test-support',
  'test-support',
  'app',
  'public',
  'vendor',
  // 'addon-templates' and 'templates are trees too, but they live inside
  // 'addon' and 'app' and we handle them there.
]);

const dynamicTreeHooks = Object.freeze([
  "treeFor",
  "treeForAddon",
  "treeForAddonTemplates",
  "treeForAddonTestSupport",
  "treeForApp",
  "treeForPublic",
  "treeForStyles",
  "treeForTemplates",
  "treeForTestSupport",
  "treeForVendor",
]);

const appPublicationDir = '_app_';

let locatePreprocessRegistry: (addonInstance: any) => any;
{
  let preprocessRegistry: any;
  locatePreprocessRegistry = function(addonInstance: any) {
    if (!preprocessRegistry) {
      let cliPath = dirname(resolvePackagePath('ember-cli', addonInstance._findHost().project.root));
      preprocessRegistry = require(resolve.sync('ember-cli-preprocess-registry/preprocessors', { basedir: cliPath }));
    }
    return preprocessRegistry;
  };
}

// This controls and types the interface between our new world and the classic
// v1 addon instance.
export default class V1Addon implements V1Package {
  constructor(protected addonInstance: any, private packageCache: PackageCache, protected addonOptions: Required<Options>) {
    this.updateBabelConfig();
    if (addonInstance.registry) {
      this.updateRegistry(addonInstance.registry);
    }
  }

  @Memoize()
  private get astPrecompiler(): ASTPrecompiler | undefined {
    let htmlbars = this.addonInstance.addons.find((a: any) => a.name === 'ember-cli-htmlbars');
    if (htmlbars) {
      let options = htmlbars.htmlbarsOptions() as HTMLBarsOptions;
      if (options.plugins && options.plugins.ast) {
        // our macros don't run here in stage1
        options.plugins.ast = options.plugins.ast.filter((p: any) => !isEmbroiderMacrosPlugin(p));
        if (options.plugins.ast.length > 0) {
          return new ASTPrecompiler(options);
        }
      }
    }
  }

  private updateRegistry(registry: any) {
    // note that we don't remove ember-cli-babel here, instead we have pared
    // down its config so that it will only run nonstandard plugins, leaving all
    // other normal ESlatest features in place.

    // auto-import gets disabled because we support it natively
    registry.remove('js', 'ember-auto-import-analyzer');

    // here we're replacing the stock template compiler with our own. Ours
    // leaves hbs files as hbs, not js. The only transformation it is supposed
    // to do is applying any custom AST transforms and reserializing the results
    // back to HBS.
    //
    // Even when no AST transforms are registered, we'll still need to register
    // a no-op transform here to avoid an exception coming out of ember-cli like
    // "Addon templates were detected, but there are no template compilers
    // registered".
    registry.remove('template', 'ember-cli-htmlbars');
    registry.add('template', {
      name: 'embroider-addon-templates',
      ext: 'hbs',
      _addon: this,
      toTree(this: { _addon: V1Addon }, tree: Tree): Tree {
        if (this._addon.astPrecompiler) {
          return this._addon.astPrecompiler.transform(tree);
        } else {
          // when there are no custom AST transforms, we don't need to do
          // anything at all.
          return tree;
        }
      }
    });
  }

  get name(): string {
    return this.packageJSON.name;
  }

  protected get packageJSON() {
    return this.addonInstance.pkg;
  }

  get rewrittenPackageJSON() {
    return this.makeV2Trees().packageJSONRewriter.lastPackageJSON;
  }

  @Memoize()
  get root(): string {
    // addonInstance.root gets modified by a customized "main" or
    // "ember-addon.main" in package.json. We want the real package root here
    // (the place where package.json lives).
    return dirname(pkgUpSync(this.addonInstance.root)!);
  }

  private parseImports(tree: Tree) {
    return new ImportParser(tree);
  }

  @Memoize()
  private get mainModule() {
    return require(this.addonInstance.constructor._meta_.modulePath);
  }

  protected get options() {
    if (!this.addonInstance.options) {
      this.addonInstance.options = {};
    }
    return this.addonInstance.options;
  }

  protected customizes(...treeNames: string[]) {
    return Boolean(treeNames.find(treeName => this.mainModule[treeName]));
  }

  @Memoize()
  private hasStockTree(treeName: string) {
    return this.addonInstance.treePaths && existsSync(join(this.root, this.addonInstance.treePaths[treeName]));
  }

  hasAnyTrees() : boolean {
    return Boolean(stockTreeNames.find(name => this.hasStockTree(name))) || this.customizes(...dynamicTreeHooks);
  }

  protected stockTree(treeName: string, funnelOpts?: FunnelOptions) {
    let opts = Object.assign({
      srcDir: this.addonInstance.treePaths[treeName]
    }, funnelOpts);
    return new Funnel(this.rootTree, opts);
  }

  @Memoize()
  private get rootTree() {
    return new UnwatchedDir(this.root);
  }

  @Memoize()
  private get moduleName() {
    if (typeof this.addonInstance.moduleName === 'function') {
      return this.addonInstance.moduleName();
    }
    return this.addonInstance.name;
  }

  // In an ideal world, there would be no options to this. We would just run
  // every kind of tree through every kind of transpiler, and they could freely
  // mix JS, CSS, and HBS. Unfortunately, some existing transpiler plugins like
  // ember-cli-sass will blow up if they don't find some files.
  private transpile(tree: Tree, { includeCSS } = { includeCSS: false}) {
    if (includeCSS) {
      tree = this.addonInstance.compileStyles(tree);
    }
    tree = this.addonInstance.preprocessJs(tree, '/', this.moduleName, {
      registry : this.addonInstance.registry
    });
    if (this.addonInstance.registry.load('template').length > 0) {
      tree = locatePreprocessRegistry(this.addonInstance).preprocessTemplates(tree, {
        registry: this.addonInstance.registry
      });
    }
    return tree;
  }

  @Memoize()
  protected updateBabelConfig() {
    let packageOptions = this.options;
    let emberCLIBabelInstance = this.addonInstance.addons.find((a: any) => a.name === 'ember-cli-babel');
    let version;

    if (emberCLIBabelInstance) {
      version = require(join(emberCLIBabelInstance.root, 'package')).version;
    }

    if (!packageOptions['ember-cli-babel']) {
      packageOptions['ember-cli-babel'] = {};
    }

    if (!packageOptions.babel) {
      packageOptions.babel = {};
    }
    let babelConfig = packageOptions.babel as TransformOptions;

    Object.assign(packageOptions['ember-cli-babel'], {
      compileModules: false,
      disablePresetEnv: true,
      disableDebugTooling: true,
      disableEmberModulesAPIPolyfill: true
    });

    if (version && semver.satisfies(version, '^5')) {
      unsupported(`${this.name} is using babel 5. Not installing our custom plugin.`);
      return;
    }

    if (!babelConfig.plugins) {
      babelConfig.plugins = [];
    } else {
      babelConfig.plugins = babelConfig.plugins.filter(babelPluginAllowedInStage1);
    }

    if (this.astPrecompiler) {
      babelConfig.plugins.push(this.astPrecompiler.inlineBabelPlugin());
    }

    babelConfig.plugins.push([require.resolve('@embroider/core/src/babel-plugin'), {
      ownName: this.name
    } ]);
  }

  protected get v2Trees() {
    return this.makeV2Trees().trees;
  }

  get v2Tree() {
    return mergeTrees(this.v2Trees);
  }

  // this is split out so that compatability shims can override it to add more
  // things to the package metadata.
  protected get packageMeta() {
    let built = this.build();
    return mergeWithAppend(
      {},
      built.staticMeta,
      ...built.dynamicMeta.map(d => d())
    );
  }

  @Memoize()
  private makeV2Trees() {
    let { trees, importParsers } = this.build();

    // Compat Adapters are allowed to override the packageJSON getter. So we
    // must create a Package that respects that version of packageJSON, so the
    // DependencyAnalyzer will respect tweaks made by Compat Adapters.
    let pkg = new TweakedPackage(this.packageCache.getAddon(this.root), this.packageJSON, this.packageCache);

    let analyzer = new DependencyAnalyzer(importParsers, pkg );
    let packageJSONRewriter = new RewritePackageJSON(this.rootTree, analyzer, () => this.packageMeta);
    trees.push(packageJSONRewriter);
    return { trees, packageJSONRewriter };
  }

  protected invokeOriginalTreeFor(name: string, { neuterPreprocessors } = { neuterPreprocessors: false }) {
    let original;
    try {
      if (neuterPreprocessors) {
        original = this.addonInstance.preprocessJs;
        this.addonInstance.preprocessJs = function(tree: Tree){ return tree; };
      }
      return this.addonInstance._treeFor(name);
    } finally {
      if (neuterPreprocessors) {
        this.addonInstance.preprocessJs = original;
      }
    }
  }

  protected treeForAddon(): Tree|undefined {
    if (this.customizes('treeForAddon', 'treeForAddonTemplates')) {
      let tree = this.invokeOriginalTreeFor('addon');
      if (tree) {
        return new MultiFunnel(tree, {
          srcDirs: [this.moduleName, `modules/${this.moduleName}`]
        });
      }
    } else if (this.hasStockTree('addon')) {
      return this.transpile(this.stockTree('addon', {
        exclude: ['styles/**']
      }));
    }
  }

  protected addonStylesTree(): Tree|undefined {
    if (this.customizes('treeForAddonStyles')) {
      todo(`${this.name} may have customized the addon style tree`);
    } else if (this.hasStockTree('addon-styles')) {
      return this.transpile(this.stockTree('addon-styles'), { includeCSS: true });
    }
  }

  protected treeForTestSupport(): Tree|undefined {
    if (this.customizes('treeForTestSupport')) {
      todo(`${this.name} has customized the test support tree`);
    } else if (this.hasStockTree('test-support')) {
      // this one doesn't go through transpile yet because it gets handled as
      // part of the consuming app. For example, imports should be relative to
      // the consuming app, not our own package. That is some of what is lame
      // about app trees and why they will go away once everyone is all MU.
      return new Funnel(this.stockTree('test-support'), {
        destDir: `${appPublicationDir}/tests`
      });
    }
  }

  private buildTreeForAddon(built: IntermediateBuild) {
    let addonTree = this.treeForAddon();
    if (addonTree) {
      let addonParser = this.parseImports(addonTree);
      built.importParsers.push(addonParser);
      built.trees.push(addonTree);
      if (!this.addonOptions.staticAddonTrees) {
        built.dynamicMeta.push(() => ({ 'implicit-modules': addonParser.filenames.map(f => `./${f.replace(/.js$/i, '')}`)}));
      }
    }
  }

  private buildAddonStyles(built: IntermediateBuild) {
    let addonStylesTree = this.addonStylesTree();
    if (addonStylesTree) {
      built.trees.push(addonStylesTree);
      if (!built.staticMeta['implicit-styles']) {
        built.staticMeta['implicit-styles'] = [];
      }
      built.staticMeta['implicit-styles'].push(`./${this.name}.css`);
    }
  }

  private buildTreeForStyles(built: IntermediateBuild) {
    if (this.customizes('treeForStyles')) {
      todo(`${this.name} may have customized the app style tree`);
    } else if (this.hasStockTree('styles')) {
      // The typical way these get used is via css @import from the app's own
      // CSS (or SCSS). There is no enforced namespacing but that is the
      // common pattern as far as I can tell.
      //
      // TODO: detect people doing the right thing (namespacing with their own
      // package name) and send them down the happy path. Their styles can
      // just ship inside the package root and be importable at the same name
      // as before. Detect people doing anything other than that and yell at
      // them and set up a fallback.
      built.trees.push(
        this.transpile(this.stockTree('styles', {
          destDir: '_app_styles_'
        }), { includeCSS: true })
      );
    }
  }

  private buildAddonTestSupport(built: IntermediateBuild) {
    let addonTestSupportTree;
    if (this.customizes('treeForAddonTestSupport')) {
      let { tree, getMeta } = rewriteAddonTestSupport(
        this.invokeOriginalTreeFor('addon-test-support', { neuterPreprocessors: true }),
        this.name
      );
      addonTestSupportTree = this.transpile(tree);
      built.dynamicMeta.push(getMeta);
    } else if (this.hasStockTree('addon-test-support')) {
      addonTestSupportTree = this.transpile(this.stockTree('addon-test-support', {
        destDir: 'test-support'
      }));
    }
    if (addonTestSupportTree) {
      let testSupportParser = this.parseImports(addonTestSupportTree);
      built.importParsers.push(testSupportParser);
      built.trees.push(addonTestSupportTree);
      if (!this.addonOptions.staticAddonTestSupportTrees) {
        built.dynamicMeta.push(() => ({ 'implicit-test-modules': testSupportParser.filenames.map(f => `./${f.replace(/.js$/i, '')}`)}));
      }
    }
  }

  private maybeSetAppJS(built: IntermediateBuild, tree: Tree): Tree {
    // unforunately Funnel doesn't create destDir if its input exists but is
    // empty. And we want to only put the app-js key in package.json if
    // there's really a directory for it to point to. So we need to monitor
    // the output and use dynamicMeta.
    let dirExists = false;
    built.dynamicMeta.push(() => {
      if (dirExists) {
        return { 'app-js': appPublicationDir };
      } else {
        return {};
      }
    });
    return  new AddToTree(tree, (outputPath: string) => {
      dirExists = pathExistsSync(join(outputPath, appPublicationDir));
    });
  }

  private buildTestSupport(built: IntermediateBuild) {
    let tree = this.treeForTestSupport();
    if (tree) {
      tree = this.maybeSetAppJS(built, tree);
      built.importParsers.push(this.parseImports(tree));
      built.trees.push(tree);
    }
  }

  private buildTreeForApp(built: IntermediateBuild) {
    let appTree;
    if (this.customizes('treeForApp', 'treeForTemplates')) {
      let original = this.invokeOriginalTreeFor('app');
      if (original) {
        appTree = new Funnel(original, {
          destDir: appPublicationDir
        });
      }
    } else if (this.hasStockTree('app')) {
      appTree = this.stockTree('app', {
        exclude: ['styles/**'],
        destDir: appPublicationDir
      });
    }

    if (appTree) {
      // this one doesn't go through transpile yet because it gets handled as
      // part of the consuming app. For example, imports should be relative to
      // the consuming app, not our own package. That is some of what is lame
      // about app trees and why they will go away once everyone is all MU.
      //
      // This does need to go through parseImports here, because by the time
      // these files have been merged into the app we can't tell what their
      // allowed dependencies are anymore and would get false positive
      // externals.
      appTree = this.maybeSetAppJS(built, appTree);
      built.importParsers.push(this.parseImports(appTree));
      built.trees.push(appTree);
    }

    if (
      typeof this.addonInstance.isDevelopingAddon === 'function' &&
      this.addonInstance.isDevelopingAddon() &&
      this.addonInstance.hintingEnabled()
    ) {
      let hintTree = this.addonInstance.jshintAddonTree();
      if (hintTree) {
        hintTree = this.maybeSetAppJS(built, new Funnel(hintTree, { destDir: appPublicationDir }));
        built.importParsers.push(this.parseImports(hintTree));
        built.trees.push(hintTree);
      }
    }
  }

  private buildPublicTree(built: IntermediateBuild) {
    let publicTree;
    if (this.customizes('treeForPublic')) {
      let original = this.invokeOriginalTreeFor('public');
      if (original) {
        publicTree = new Snitch(this.invokeOriginalTreeFor('public'), {
          // The normal behavior is to namespace your public files under your
          // own name. But addons can flaunt that, and that goes beyond what
          // the v2 format is allowed to do.
          allowedPaths: new RegExp(`^${this.name}/`),
          foundBadPaths: (badPaths: string[]) => `${this.name} treeForPublic contains unsupported paths: ${badPaths.join(', ')}`
        }, {
          destDir: 'public'
        });
      }
    } else if (this.hasStockTree('public')) {
      publicTree = this.stockTree('public', {
        destDir: 'public'
      });
    }
    if (publicTree) {
      let publicAssets: { [filename: string]: string } = {};
      publicTree = new AddToTree(publicTree, (outputPath: string) => {
        publicAssets = {};
        for (let filename of walkSync(join(outputPath, 'public'))) {
          if (!filename.endsWith('/')) {
            publicAssets[`public/${filename}`] = filename;
          }
        }
      });
      built.trees.push(publicTree);
      built.dynamicMeta.push(() => ({ 'public-assets': publicAssets }));
    }
  }

  private buildVendorTree(built: IntermediateBuild) {
    if (this.customizes('treeForVendor')) {
      // We don't have any particular opinions about the structure inside
      // vendor, so even when it's customized we can just use the customized
      // one.
      let tree = this.invokeOriginalTreeFor('vendor');
      if (tree) {
        built.trees.push(
          new Funnel(tree, {
            destDir: 'vendor'
          })
        );
      }
    } else if (this.hasStockTree('vendor')) {
      built.trees.push(
        this.stockTree('vendor', {
          destDir: 'vendor'
        })
      );
    }
  }

  @Memoize()
  private build() : IntermediateBuild {
    let built = new IntermediateBuild();

    if (this.moduleName !== this.name ) {
      built.staticMeta['renamed-modules'] = {
        [this.moduleName]: this.name
      };
    }

    if (this.customizes('treeFor')) {
      unsupported(`${this.name} has customized treeFor`);
    }

    this.buildTreeForAddon(built);
    this.buildAddonStyles(built);
    this.buildTreeForStyles(built);
    this.buildAddonTestSupport(built);
    this.buildTestSupport(built);
    this.buildTreeForApp(built);
    this.buildPublicTree(built);
    this.buildVendorTree(built);

    return built;
  }
}

export interface V1AddonConstructor {
  new(addonInstance: any, packageCache: PackageCache, options: Required<Options>): V1Addon;
}

class TweakedPackage extends Package {
  constructor(realPackage: Package, private overridePackageJSON: any, packageCache: PackageCache) {
    super(realPackage.root, false, packageCache);
  }
  get packageJSON() {
    return this.overridePackageJSON;
  }
}

class IntermediateBuild {
  trees: Tree[] = [];
  importParsers: ImportParser[] = [];
  staticMeta: { [metaField: string]: any } = {};
  dynamicMeta: (() => Partial<AddonMeta>)[] = [];
}

function babelPluginAllowedInStage1(plugin: PluginItem) {
  if (isEmbroiderMacrosPlugin(plugin)) {
    // the point of @embroider/macros is that it's allowed to stay in v2
    // addon publication format, so it doesn't need to run here in stage1.
    // We always run it in stage3.
    return false;
  }

  if (isInlinePrecompilePlugin(plugin)) {
    // Similarly, the inline precompile plugin must not run in stage1. We
    // want all templates uncompiled. Instead, we will be adding our own
    // plugin that only runs custom AST transforms inside inline
    // templates.
    return false;
  }

  return true;
}
