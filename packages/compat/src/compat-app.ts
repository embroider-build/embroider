import { Tree } from 'broccoli-plugin';
import mergeTrees from 'broccoli-merge-trees';
import {
  Package,
  Stage,
  AppMeta,
  PackageCache,
  OutputPaths,
  BuildStage,
  getOrCreate
} from '@embroider/core';
import sortBy from 'lodash/sortBy';
import resolve from 'resolve';
import { TrackedImports } from './tracked-imports';
import { Memoize } from "typescript-memoize";
import V1InstanceCache from './v1-instance-cache';
import V1App from './v1-app';
import walkSync from 'walk-sync';
import { writeFileSync, ensureDirSync, readFileSync, copySync } from 'fs-extra';
import { join, dirname, relative } from 'path';
import { compile } from './js-handlebars';
import { todo, unsupported } from './messages';
import cloneDeep from 'lodash/cloneDeep';
import { JSDOM } from 'jsdom';
import DependencyAnalyzer from './dependency-analyzer';
import { V1Config, ConfigContents, EmberENV } from './v1-config';
import AppDiffer from '@embroider/core/src/app-differ';
import { Asset, EmberAsset, ImplicitAssetType } from './app';
import { insertNewline, insertScriptTag, insertStyleLink } from './dom-util';

const entryTemplate = compile(`
let w = window;
let d = w.define;

{{#if needsEmbroiderHook}}
  {{!-
    This function is the entrypoint that final stage packagers should
    use to lookup externals at runtime.
  -}}
  w._embroider_ = function(specifier) {
    let m;
    if (specifier === 'require') {
      m = w.require;
    } else {
      m = w.require(specifier);
    }
    {{!-
      There are plenty of hand-written AMD defines floating around
      that lack this, and they will break when other build systems
      encounter them.

      As far as I can tell, Ember's loader was already treating this
      case as a module, so in theory we aren't breaking anything by
      marking it as such when other packagers come looking.

      todo: get review on this part.
    -}}
    if (m.default && !m.__esModule) {
      m.__esModule = true;
    }
    return m;
  };
{{/if}}

{{#each eagerModules as |eagerModule| ~}}
  import "{{js-string-escape eagerModule}}";
{{/each}}

{{#each lazyModules as |lazyModule| ~}}
  d("{{js-string-escape lazyModule.runtime}}", function(){ return require("{{js-string-escape lazyModule.buildtime}}");});
{{/each}}

{{#if autoRun ~}}
  require("{{js-string-escape mainModule}}").default.create({{{json-stringify appConfig}}});
{{/if}}

{{#if testSuffix ~}}
  {{!- this is the traditioanl tests-suffix.js -}}
  require('../tests/test-helper');
  EmberENV.TESTS_FILE_LOADED = true;
{{/if}}
`);

class Options {
  extraPublicTrees?: Tree[];
}

interface TreeNames {
  appJS: Tree;
  analyzer: Tree;
  htmlTree: Tree;
  publicTree: Tree;
  configTree: Tree;
}

class CompatAppBuilder {

  // This runs at broccoli-pipeline-construction time, whereas our actual instance
  // only becomes available during actual tree-building time.
  static setup(legacyEmberAppInstance: object, options?: Options ) {
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
      return new this(
        root,
        packageCache.getApp(appSrcDir),
        oldPackage,
        configTree,
        analyzer
      );
    };

    return { inTrees, instantiate };
  }

  constructor(
    private root: string,
    private app: Package,
    private oldPackage: V1App,
    private configTree: V1Config,
    private analyzer: DependencyAnalyzer
  ) {}

  @Memoize()
  private get activeAddonDescendants(): Package[] {
    // todo: filter by addon-provided hook
    return this.app.findDescendants(dep => dep.isEmberPackage);
  }

  private get autoRun(): boolean {
    return this.oldPackage.autoRun;
  }

  private get isModuleUnification(): boolean {
    return this.oldPackage.isModuleUnification;
  }

  private scriptPriority(pkg: Package) {
    switch (pkg.name) {
      case "loader.js":
        return 0;
      case "ember-source":
        return 10;
      default:
        return 1000;
    }
  }

  private impliedAssets(type: ImplicitAssetType): any {
    let result = this.impliedAddonAssets(type).concat(this.impliedAppAssets(type));

    // This file gets created by addEmberEnv(). We need to insert it at the
    // beginning of the scripts.
    if (type === "implicit-scripts") {
      result.unshift(join(this.root, "_ember_env_.js"));
    }
    return result;
  }

  private impliedAppAssets(type: ImplicitAssetType): string[] {
    let result = [];
    let imports = new TrackedImports(
      this.app.name,
      this.oldPackage.trackedImports
    ).meta[type];
    if (imports) {
      for (let mod of imports) {
        result.push(resolve.sync(mod, { basedir: this.root }));
      }
    }
    return result;
  }

  private impliedAddonAssets(type: ImplicitAssetType): any {
    let result = [];
    for (let addon of sortBy(
      this.activeAddonDescendants,
      this.scriptPriority.bind(this)
    )) {
      let implicitScripts = addon.meta[type];
      if (implicitScripts) {
        for (let mod of implicitScripts) {
          result.push(resolve.sync(mod, { basedir: addon.root }));
        }
      }
    }
    return result;
  }

  @Memoize()
  private get babelConfig() {
    let rename = Object.assign(
      {},
      ...this.activeAddonDescendants.map(dep => dep.meta["renamed-modules"])
    );
    return this.oldPackage.babelConfig(this.root, rename);
  }

  private insertEmberApp(asset: EmberAsset, config: ConfigContents, appFiles: Set<string>, jsEntrypoints: Map<string, Asset>): Asset[] {
    let newAssets: Asset[] = [];

    let appJS = getOrCreate(jsEntrypoints, `assets/${this.app.name}.js`, () => {
      let js = this.javascriptEntrypoint(this.app.name, config, appFiles);
      newAssets.push(js);
      return js;
    });

    insertScriptTag(
      asset,
      asset.javascript,
      appJS.relativePath
    ).type = 'module';

    insertStyleLink(
      asset,
      asset.styles,
      `assets/${this.app.name}.css`
    );

    this.addImplicitJS(
      asset,
      asset.implicitScripts,
      "implicit-scripts"
    );

    this.addImplicitCSS(
      asset,
      asset.implicitStyles,
      "implicit-styles"
    );

    if (asset.includeTests) {

      let testJS = getOrCreate(jsEntrypoints, `assets/test.js`, () => {
        let js = this.testJSEntrypoint(appFiles);
        newAssets.push(js);
        return js;
      });

      insertScriptTag(
        asset,
        asset.testJavascript || asset.javascript,
        testJS.relativePath
      ).type = 'module';

      this.addImplicitJS(
        asset,
        asset.implicitTestScripts || asset.implicitScripts,
        "implicit-test-scripts"
      );

      this.addImplicitCSS(
        asset,
        asset.implicitTestStyles || asset.implicitStyles,
        "implicit-test-styles"
      );
    }
    this.stripInsertionMarkers(asset);
    return newAssets;
  }

  private addImplicitJS(
    asset: EmberAsset,
    marker: Node,
    type: ImplicitAssetType
  ) {
    for (let insertedScript of this.impliedAssets(type)) {
      let s = asset.dom.window.document.createElement("script");
      s.src = relative(dirname(join(this.root, asset.relativePath)), insertedScript);
      insertNewline(marker);
      marker.parentElement!.insertBefore(s, marker);
    }
  }

  private addImplicitCSS(
    asset: EmberAsset,
    marker: Node,
    type: ImplicitAssetType
  ) {
    for (let insertedStyle of this.impliedAssets(type)) {
      let s = asset.dom.window.document.createElement("link");
      s.rel = "stylesheet";
      s.href = relative(dirname(join(this.root, asset.relativePath)), insertedStyle);
      insertNewline(marker);
      marker.parentElement!.insertBefore(s, marker);
    }
  }

  // todo
  private shouldBuildTests = true;

  private appDiffer: AppDiffer | undefined;

  private updateAppJS(appJSPath: string): Set<string> {
    if (!this.appDiffer) {
      this.appDiffer = new AppDiffer(this.root, appJSPath, this.activeAddonDescendants);
    }
    this.appDiffer.update();
    return this.appDiffer.files;
  }

  private assets(treePaths: OutputPaths<TreeNames>): Asset[] {
    // Everything in our traditional public tree is an on-disk asset
    let assets = walkSync(treePaths.publicTree, {
      directories: false,
    }).map((file): Asset => ({
      kind: 'on-disk',
      relativePath: file,
      sourcePath: join(treePaths.publicTree, file)
    }));

    for (let asset of this.rewriteHTML(treePaths.htmlTree)) {
      assets.push(asset);
    }

    return assets;
  }

  private emitAsset(asset: Asset, config: ConfigContents, appFiles: Set<string>, jsEntrypoints: Map<string, Asset>) {
    let destination = join(this.root, asset.relativePath);
    let newAssets: Asset[] = [];
    ensureDirSync(dirname(destination));
    switch (asset.kind) {
      case 'in-memory':
        writeFileSync(
          destination,
          asset.source,
          "utf8"
        );
        break;
      case 'on-disk':
        copySync(asset.sourcePath, destination, { dereference: true });
        break;
      case 'ember':
        newAssets = this.insertEmberApp(asset, config, appFiles, jsEntrypoints);
        writeFileSync(destination, asset.dom.serialize(), "utf8");
        break;
      default:
        assertNever(asset);
    }
    return newAssets;
  }

  async build(inputPaths: OutputPaths<TreeNames>) {
    let appFiles = this.updateAppJS(inputPaths.appJS);
    let config = this.configTree.readConfig();
    let assets = this.assets(inputPaths);

    // this serves as a shared cache as we're filling out each of the html entrypoints
    let jsEntrypoints: Map<string, Asset> = new Map();

    let queue = assets.slice();
    while (queue.length > 0) {
      let asset = queue.shift()!;
      let newAssets = this.emitAsset(asset, config, appFiles, jsEntrypoints);
      queue = queue.concat(newAssets);
    }

    this.addTemplateCompiler(config.EmberENV);
    this.addBabelConfig();
    this.addEmberEnv(config.EmberENV);

    let externals = this.combineExternals();

    let meta: AppMeta = {
      version: 2,
      externals,
      entrypoints: assets.map(a => a.relativePath),
      ["template-compiler"]: "_template_compiler_.js",
      ["babel-config"]: "_babel_config_.js",
    };

    let pkg = cloneDeep(this.app.packageJSON);
    pkg["ember-addon"] = Object.assign({}, pkg["ember-addon"], meta);
    writeFileSync(
      join(this.root, "package.json"),
      JSON.stringify(pkg, null, 2),
      "utf8"
    );
  }

  private combineExternals() {
    let allAddonNames = new Set(this.activeAddonDescendants.map(d => d.name));
    let externals = new Set();
    for (let addon of this.activeAddonDescendants) {
      if (!addon.meta.externals) {
        continue;
      }
      for (let name of addon.meta.externals) {
        if (allAddonNames.has(name)) {
          unsupported(`${addon.name} imports ${name} but does not directly depend on it.`);
        } else {
          externals.add(name);
        }
      }
    }

    for (let name of this.analyzer.externals) {
      if (allAddonNames.has(name)) {
        unsupported(`your app imports ${name} but does not directly depend on it.`);
      } else {
        externals.add(name);
      }
    }
    return [...externals.values()];
  }

  // we could just use ember-source/dist/ember-template-compiler directly, but
  // apparently ember-cli adds some extra steps on top (like stripping BOM), so
  // we follow along and do those too.
  private addTemplateCompiler(config: EmberENV) {
    let plugins = this.oldPackage.htmlbarsPlugins;
    (global as any).__embroiderHtmlbarsPlugins__ = plugins;
    writeFileSync(
      join(this.root, "_template_compiler_.js"),
      `
    var compiler = require('ember-source/vendor/ember/ember-template-compiler');
    var setupCompiler = require('@embroider/core/src/template-compiler').default;
    var EmberENV = ${JSON.stringify(config)};
    var plugins = global.__embroiderHtmlbarsPlugins__;
    if (!plugins) {
      throw new Error('You must run your final stage packager in the same process as CompatApp, because there are unserializable AST plugins');
    }
    module.exports = setupCompiler(compiler, EmberENV, plugins);
    `,
      "utf8"
    );
  }

  private addBabelConfig() {
    let { config, syntheticPlugins } = this.babelConfig;

    for (let [name, source] of syntheticPlugins) {
      let fullName = join(this.root, name);
      writeFileSync(fullName, source, 'utf8');
      let index = config.plugins.indexOf(name);
      config.plugins[index] = fullName;
    }

    writeFileSync(
      join(this.root, "_babel_config_.js"),
      `
    module.exports = ${JSON.stringify(config, null, 2)};
    `,
      "utf8"
    );
  }

  // this is stuff that needs to get set globally before Ember loads. In classic
  // Ember CLI is was "vendor-prefix" content that would go at the start of the
  // vendor.js. We are going to make sure it's the first plain <script> in the
  // HTML that we hand to the final stage packager.
  private addEmberEnv(config: EmberENV) {
    writeFileSync(
      join(this.root, "_ember_env_.js"),
      `
    window.EmberENV=${JSON.stringify(config, null, 2)};
    `,
      "utf8"
    );
  }

  private maybeReplace(dom: JSDOM, element: Element | undefined): Node | undefined {
    if (element) {
      return this.definitelyReplace(dom, element, "", "");
    }
  }

  private definitelyReplace(dom: JSDOM, element: Element | undefined, description: string, file: string): Node {
    if (!element) {
      throw new Error(`could not find ${description} in ${file}`);
    }
    let placeholder = dom.window.document.createComment('');
    element.replaceWith(placeholder);
    return placeholder;
  }

  private stripInsertionMarkers(asset: EmberAsset) {
    let nodes = [
      asset.javascript,
      asset.styles,
      asset.implicitScripts,
      asset.implicitStyles,
      asset.testJavascript,
      asset.implicitTestScripts,
      asset.implicitTestStyles
    ];
    for (let node of nodes) {
      if (node && node.parentElement) {
          node.parentElement.removeChild(node);
      }
    }
  }

  private * rewriteHTML(htmlTreePath: string): IterableIterator<Asset> {
    let classicEntrypoints = [
      { entrypoint: 'index.html', includeTests: false },
      { entrypoint: 'tests/index.html', includeTests: true },
    ];
    if (!this.shouldBuildTests) {
      classicEntrypoints.pop();
    }
    for (let { entrypoint, includeTests } of classicEntrypoints) {
      let dom = new JSDOM(readFileSync(join(htmlTreePath, entrypoint), "utf8"));
      let scripts = [...dom.window.document.querySelectorAll("script")];
      let styles = [
        ...dom.window.document.querySelectorAll('link[rel="stylesheet"]'),
      ] as HTMLLinkElement[];

      let asset: EmberAsset = {
        kind: 'ember',
        relativePath: entrypoint,
        dom,
        includeTests,
        javascript: this.definitelyReplace(dom, this.oldPackage.findAppScript(scripts), 'app javascript', entrypoint),
        styles: this.definitelyReplace(dom, this.oldPackage.findAppStyles(styles), 'app styles', entrypoint),
        implicitScripts: this.definitelyReplace(dom, this.oldPackage.findVendorScript(scripts), 'vendor javascript', entrypoint),
        implicitStyles: this.definitelyReplace(dom, this.oldPackage.findVendorStyles(styles), 'vendor styles', entrypoint),
        testJavascript: this.maybeReplace(dom, this.oldPackage.findTestScript(scripts)),
        implicitTestScripts: this.maybeReplace(dom, this.oldPackage.findTestSupportScript(scripts)),
        implicitTestStyles: this.maybeReplace(dom, this.oldPackage.findTestSupportStyles(styles)),
      };
      yield asset;
    }
  }

  private javascriptEntrypoint(name: string, config: ConfigContents, appFiles: Set<string>): Asset {
    // for the app tree, we take everything
    let lazyModules = [...appFiles].map(relativePath => {
      if (!relativePath.startsWith('tests/') && (relativePath.endsWith('.js') || relativePath.endsWith('.hbs'))) {
        let noJS = relativePath.replace(/\.js$/, "");
        let noHBS = noJS.replace(/\.hbs$/, "");
        return {
          runtime: `${config.modulePrefix}/${noHBS}`,
          buildtime: `../${noJS}`,
        };
      }
    }).filter(Boolean) as { runtime: string, buildtime: string }[];

    // for the src tree, we can limit ourselves to only known resolvable
    // collections
    todo("app src tree");

    // this is a backward-compatibility feature: addons can force inclusion of
    // modules.
    this.gatherImplicitModules('implicit-modules', lazyModules);

    let relativePath = `assets/${name}.js`;
    let mainModule = this.isModuleUnification ? "src/main" : "app";

    let source = entryTemplate({
      needsEmbroiderHook: true,
      lazyModules,
      autoRun: this.autoRun,
      mainModule: relative(dirname(relativePath), mainModule),
      appConfig: config.APP,
    });

    return {
      kind: 'in-memory',
      source,
      relativePath,
    };
  }

  private testJSEntrypoint(appFiles: Set<string>): Asset {
    let testModules = [...appFiles].map(relativePath => {
      if (relativePath.startsWith("tests/") && relativePath.endsWith('-test.js')) {
        return `../${relativePath}`;
      }
    }).filter(Boolean) as string[];

    let lazyModules: { runtime: string, buildtime: string }[] = [];
    // this is a backward-compatibility feature: addons can force inclusion of
    // test support modules.
    this.gatherImplicitModules('implicit-test-modules', lazyModules);

    let source = entryTemplate({
      lazyModules,
      eagerModules: testModules,
      testSuffix: true
    });

    return {
      kind: 'in-memory',
      source,
      relativePath: 'assets/test.js'
    };
  }

  private gatherImplicitModules(section: "implicit-modules" | "implicit-test-modules", lazyModules: { runtime: string, buildtime: string }[]) {
    for (let addon of this.activeAddonDescendants) {
      let implicitModules = addon.meta[section];
      if (implicitModules) {
        for (let name of implicitModules) {
          lazyModules.push({
            runtime: join(addon.name, name),
            buildtime: relative(
              join(this.root, "assets"),
              join(addon.root, name)
            ),
          });
        }
      }
    }
  }
}

export default class CompatApp extends BuildStage<TreeNames> {
  constructor(legacyEmberAppInstance: object, addons: Stage, options?: Options) {
    let { inTrees, instantiate } = CompatAppBuilder.setup(legacyEmberAppInstance, options);
    super(addons, inTrees, instantiate);
  }
}

function assertNever(_: never) {}
