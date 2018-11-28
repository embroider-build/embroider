import BroccoliPlugin, { Tree } from 'broccoli-plugin';
import mergeTrees from 'broccoli-merge-trees';
import {
  App,
  Package,
  Workspace,
  AppMeta,
  PackageCache
} from '@embroider/core';
import sortBy from 'lodash/sortBy';
import resolve from 'resolve';
import { TrackedImports } from './tracked-imports';
import { Memoize } from "typescript-memoize";
import V1InstanceCache from './v1-instance-cache';
import V1App from './v1-app';
import walkSync from 'walk-sync';
import { writeFileSync, ensureDirSync, readFileSync, copySync, readdirSync, removeSync } from 'fs-extra';
import { join, dirname, relative } from 'path';
import { compile } from './js-handlebars';
import { todo, unsupported } from './messages';
import cloneDeep from 'lodash/cloneDeep';
import { JSDOM } from 'jsdom';
import DependencyAnalyzer from './dependency-analyzer';

const entryTemplate = compile(`
{{!-
    This function is the entrypoint that final stage packagers should
    use to lookup externals at runtime.
-}}
let w = window;
let r = w.require;
let d = w.define;
w._vanilla_ = function(specifier) {
  let m;
  if (specifier === 'require') {
    m = r;
  } else {
    m = r(specifier);
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
{{#each lazyModules as |lazyModule| ~}}
  d("{{js-string-escape lazyModule.runtime}}", function(){ return require("{{js-string-escape lazyModule.buildtime}}");});
{{/each}}
{{#if autoRun ~}}
  require("{{js-string-escape mainModule}}").default.create({{{json-stringify appConfig}}});
{{/if}}
`);

const testTemplate = compile(`
{{#each testModules as |testModule| ~}}
  import "{{js-string-escape testModule}}";
{{/each}}

{{#if lazyModules}}
  let d = window.define;
{{/if}}
{{#each lazyModules as |lazyModule| ~}}
  d("{{js-string-escape lazyModule.runtime}}", function(){ return require("{{js-string-escape lazyModule.buildtime}}");});
{{/each}}

{{!- this is the traditioanl tests-suffix.js -}}
require('../tests/test-helper');
EmberENV.TESTS_FILE_LOADED = true;
`);

class Options {
  extraPublicTrees?: Tree[];
}

export default class CompatApp implements App {
  private extraPublicTrees: Tree[] | undefined;
  private oldPackage: V1App;
  private active: ActiveCompatApp | undefined;

  constructor(legacyEmberAppInstance: object, private workspace: Workspace, options?: Options) {
    if (options && options.extraPublicTrees) {
      this.extraPublicTrees = options.extraPublicTrees;
    }
    this.oldPackage = V1InstanceCache.forApp(legacyEmberAppInstance).app;
  }

  get tree(): Tree {
    let { analyzer, appJS } = this.oldPackage.processAppJS();
    let htmlTree = this.oldPackage.htmlTree;
    let publicTree = this.oldPackage.publicTree;
    let configTree = this.oldPackage.config;

    if (this.extraPublicTrees) {
      publicTree = mergeTrees([publicTree, ...this.extraPublicTrees]);
    }

    let inTrees: TreeNames<Tree> = {
      workspace: this.workspace,
      appJS,
      analyzer,
      htmlTree,
      publicTree,
      configTree,
    };

    return new WaitForTrees(inTrees, (treePaths) => this.build(treePaths, configTree, analyzer));
  }

  async ready(): Promise<{ root: string, packageCache: PackageCache | undefined }>{
    await this.deferReady.promise;
    return {
      root: this.active!.root,
      packageCache: this.active!.packageCache
    };
  }

  private async build(treePaths: TreeNames<string>, configTree: ConfigTree, analyzer: DependencyAnalyzer) {
    if (!this.active) {
      let { appDestDir, app, packageCache } = await this.workspace.ready();
      this.active = new ActiveCompatApp(
        appDestDir,
        app,
        packageCache,
        this.oldPackage,
        configTree,
        analyzer
        );
    }
    await this.active.build(treePaths);
    this.deferReady.resolve();
  }

  @Memoize()
  private get deferReady() {
    let resolve: Function;
    let promise: Promise<void> = new Promise(r => resolve =r);
    return { resolve: resolve!, promise };
  }
}

// This class holds state that's only available after the Workspace we are
// building against has had a chance to complete its broccoli build step. In
// general in broccoli, it's important to keep clear the distinction between
// "pipline construction time" (which we deal with in CompatApp) and "tree
// building time" (which we deal with in ActiveCompatApp).
class ActiveCompatApp {
  constructor(
    readonly root: string,
    private app: Package,
    readonly packageCache: PackageCache | undefined,
    private oldPackage: V1App,
    private configTree: ConfigTree,
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

  private assets(originalBundle: string): any {
    let group: "appJS" | "appCSS" | "testJS" | "testCSS";
    let metaKey:
      | "implicit-scripts"
      | "implicit-styles"
      | "implicit-test-scripts"
      | "implicit-test-styles";
    switch (originalBundle) {
      case "vendor.js":
        group = "appJS";
        metaKey = "implicit-scripts";
        break;
      case "vendor.css":
        group = "appCSS";
        metaKey = "implicit-styles";
        break;
      case "test-support.js":
        group = "testJS";
        metaKey = "implicit-test-scripts";
        break;
      case "test-support.css":
        group = "testCSS";
        metaKey = "implicit-test-styles";
        break;
      default:
        throw new Error(`unimplemented originalBundle ${originalBundle}`);
    }
    let result = [];
    for (let addon of sortBy(
      this.activeAddonDescendants,
      this.scriptPriority.bind(this)
    )) {
      let implicitScripts = addon.meta[metaKey];
      if (implicitScripts) {
        for (let mod of implicitScripts) {
          result.push(resolve.sync(mod, { basedir: addon.root }));
        }
      }
    }
    let imports = new TrackedImports(
      this.app.name,
      this.oldPackage.trackedImports
    );
    for (let mod of imports.categorized[group]) {
      result.push(resolve.sync(mod, { basedir: this.root }));
    }

    // This file gets created by app-entrypoint.ts. We need to insert it at the
    // beginning of the scripts.
    if (originalBundle === "vendor.js") {
      result.unshift(join(this.root, "_ember_env_.js"));
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

  private updateHTML(entrypoint: string, dom: JSDOM) {
    let scripts = [...dom.window.document.querySelectorAll("script")];
    this.updateAppJS(entrypoint, scripts);
    this.updateTestJS(entrypoint, scripts);
    this.updateJS(
      dom,
      entrypoint,
      this.oldPackage.findVendorScript(scripts),
      "vendor.js"
    );
    this.updateJS(
      dom,
      entrypoint,
      this.oldPackage.findTestSupportScript(scripts),
      "test-support.js"
    );

    let styles = [
      ...dom.window.document.querySelectorAll('link[rel="stylesheet"]'),
    ] as HTMLLinkElement[];
    this.updateAppCSS(entrypoint, styles);
    this.updateCSS(
      dom,
      entrypoint,
      this.oldPackage.findVendorStyles(styles),
      "vendor.css"
    );
    this.updateCSS(
      dom,
      entrypoint,
      this.oldPackage.findTestSupportStyles(styles),
      "test-support.css"
    );
  }

  private updateAppJS(entrypoint: string, scripts: HTMLScriptElement[]) {
    // no custom name allowed here -- we're standardizing. It's not the final
    // output anyway, that will be up to the final stage packager. We also
    // switch to module type, to convey that we're going to point at an ES
    // module.
    let appJS = this.oldPackage.findAppScript(scripts);
    if (appJS) {
      appJS.src = relative(
        dirname(join(this.root, entrypoint)),
        join(this.root, `assets/${this.app.name}.js`)
      );
      appJS.type = "module";
    }
  }

  private updateTestJS(entrypoint: string, scripts: HTMLScriptElement[]) {
    let testJS = this.oldPackage.findTestScript(scripts);
    if (testJS) {
      testJS.src = relative(
        dirname(join(this.root, entrypoint)),
        join(this.root, `assets/test.js`)
      );
      testJS.type = "module";
    }
  }

  private updateJS(
    dom: JSDOM,
    entrypoint: string,
    original: HTMLScriptElement | undefined,
    bundleName: string
  ) {
    // the vendor.js file gets replaced with each of our implicit scripts. It's
    // up to the final stage packager to worry about concatenation.
    if (!original) {
      return;
    }
    for (let insertedScript of this.assets(bundleName)) {
      let s = dom.window.document.createElement("script");
      s.src = relative(dirname(join(this.root, entrypoint)), insertedScript);
      // these newlines make the output more readable
      original.parentElement!.insertBefore(
        dom.window.document.createTextNode("\n"),
        original
      );
      original.parentElement!.insertBefore(s, original);
    }
    original.remove();
  }

  private updateAppCSS(entrypoint: string, styles: HTMLLinkElement[]) {
    // no custom name allowed here. Same argument applies here as for appJS
    // above.
    let appCSS = this.oldPackage.findAppStyles(styles);
    if (appCSS) {
      appCSS.href = relative(
        dirname(join(this.root, entrypoint)),
        join(this.root, `assets/${this.app.name}.css`)
      );
    }
  }

  private updateCSS(
    dom: JSDOM,
    entrypoint: string,
    original: HTMLLinkElement | undefined,
    bundleName: string
  ) {
    // the vendor.css file gets replaced with each of our implicit CSS
    // dependencies. It's up to the final stage packager to worry about
    // concatenation.
    if (!original) {
      return;
    }
    for (let insertedStyle of this.assets(bundleName)) {
      let s = dom.window.document.createElement("link");
      s.rel = "stylesheet";
      s.href = relative(dirname(join(this.root, entrypoint)), insertedStyle);
      original.parentElement!.insertBefore(
        dom.window.document.createTextNode("\n"),
        original
      );
      original.parentElement!.insertBefore(s, original);
    }
    original.remove();
  }

  // todo
  private shouldBuildTests = true;

  private emberEntrypoints() {
    let entrypoints = ["index.html"];
    if (this.shouldBuildTests) {
      entrypoints.push("tests/index.html");
    }
    return entrypoints;
  }

  private clearApp() {
    for (let name of readdirSync(this.root)) {
      if (name !== 'node_modules') {
        removeSync(join(this.root, name));
      }
    }
  }

  async build(inputPaths: TreeNames<string>) {
    // the steps in here are order dependent!

    // readConfig timing is safe here because configTree is in our input trees.
    let config = this.configTree.readConfig();

    // start with a clean app directory, leaving only our node_modules
    this.clearApp();

    // first thing we add: we're copying only "app-js"
    // stuff, first from addons, and then from the app itself (so it can
    // ovewrite the files from addons).
    for (let addon of this.activeAddonDescendants) {
      let appJSPath = addon.meta["app-js"];
      if (appJSPath) {
        copySync(join(addon.root, appJSPath), this.root);
      }
    }
    copySync(inputPaths.appJS, this.root, { dereference: true });

    // At this point, all all-js and *only* app-js has been copied into the
    // project, so we can crawl the results to discover what needs to go into
    // the Javascript entrypoint files.
    this.writeAppJSEntrypoint(config);
    this.writeTestJSEntrypoint();

    // now we're clear to copy other things and they won't perturb the
    // entrypoint files
    copySync(inputPaths.publicTree, this.root, { dereference: true });

    this.addTemplateCompiler(config.EmberENV);
    this.addBabelConfig();
    this.addEmberEnv(config.EmberENV);

    let externals = this.combineExternals();

    // This is the publicTree we were given. We need to list all the files in
    // here as "entrypoints", because an "entrypoint" is anything that is
    // guaranteed to have a valid URL in the final build output.
    let entrypoints = walkSync(inputPaths.publicTree, {
      directories: false,
    });

    let meta: AppMeta = {
      version: 2,
      externals,
      entrypoints: this.emberEntrypoints().concat(entrypoints),
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
    this.rewriteHTML(inputPaths.htmlTree);
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
  private addTemplateCompiler(config: any) {
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
  private addEmberEnv(config: any) {
    writeFileSync(
      join(this.root, "_ember_env_.js"),
      `
    window.EmberENV=${JSON.stringify(config, null, 2)};
    `,
      "utf8"
    );
  }

  private rewriteHTML(htmlTreePath: string) {
    for (let entrypoint of this.emberEntrypoints()) {
      let dom = new JSDOM(readFileSync(join(htmlTreePath, entrypoint), "utf8"));
      this.updateHTML(entrypoint, dom);
      let outputFile = join(this.root, entrypoint);
      ensureDirSync(dirname(outputFile));
      writeFileSync(outputFile, dom.serialize(), "utf8");
    }
  }

  private writeAppJSEntrypoint(config: any) {
    let mainModule = join(
      this.root,
      this.isModuleUnification ? "src/main" : "app"
    );
    // standard JS file name, not customizable. It's not final anyway (that is
    // up to the final stage packager). See also updateHTML in app.ts for where
    // we're enforcing this in the HTML.
    let appJS = join(this.root, `assets/${this.app.name}.js`);

    // for the app tree, we take everything
    let lazyModules = walkSync(this.root, {
      globs: ["**/*.{js,hbs}"],
      ignore: ["tests", "node_modules"],
      directories: false,
    }).map(specifier => {
      let noJS = specifier.replace(/\.js$/, "");
      let noHBS = noJS.replace(/\.hbs$/, "");
      return {
        runtime: `${config.modulePrefix}/${noHBS}`,
        buildtime: `../${noJS}`,
      };
    });

    // for the src tree, we can limit ourselves to only known resolvable
    // collections
    todo("app src tree");

    // this is a backward-compatibility feature: addons can force inclusion of
    // modules.
    this.gatherImplicitModules('implicit-modules', lazyModules);

    ensureDirSync(dirname(appJS));
    writeFileSync(
      appJS,
      entryTemplate({
        lazyModules,
        autoRun: this.autoRun,
        mainModule: relative(dirname(appJS), mainModule),
        appConfig: config.APP,
      }),
      "utf8"
    );
  }

  private writeTestJSEntrypoint() {
    let testJS = join(this.root, `assets/test.js`);
    let testModules = walkSync(this.root, {
      globs: ["tests/**/*-test.js"],
      directories: false,
    }).map(specifier => `../${specifier}`);

    let lazyModules: { runtime: string, buildtime: string }[] = [];
    // this is a backward-compatibility feature: addons can force inclusion of
    // test support modules.
    this.gatherImplicitModules('implicit-test-modules', lazyModules);

    ensureDirSync(dirname(testJS));
    writeFileSync(
      testJS,
      testTemplate({
        testModules,
        lazyModules
      }),
      "utf8"
    );
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
              `${addon.root}/${name}`
            ),
          });
        }
      }
    }
  }
}

export interface ConfigTree extends Tree {
  readConfig: () => any;
}

interface TreeNames<T> {
  workspace: T;
  appJS: T;
  analyzer: T;
  htmlTree: T;
  publicTree: T;
  configTree: T;
}

class WaitForTrees extends BroccoliPlugin {
  constructor(
    private trees: TreeNames<Tree>,
    private buildHook: (trees: TreeNames<string>) => Promise<void>,
  ){
    super(Object.values(trees), {});
  }

  async build() {
    let treeNames = Object.keys(this.trees);
    let inputPathsByName: { [treeName: string]: string } = {};
    for (let i = 0; i < this.inputPaths.length; i++) {
      inputPathsByName[treeNames[i]] = this.inputPaths[i];
    }
    return this.buildHook(inputPathsByName as unknown as TreeNames<string>);
  }
}
