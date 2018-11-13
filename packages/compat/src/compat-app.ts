import BroccoliPlugin, { Tree } from 'broccoli-plugin';
import mergeTrees from 'broccoli-merge-trees';
import {
  App,
  Package,
  EmberPackage,
  Workspace,
  AppPackageJSON,
  WorkspaceUpdater
} from '@embroider/core';
import sortBy from 'lodash/sortBy';
import resolve from 'resolve';
import { TrackedImports } from './tracked-imports';
import { Memoize } from "typescript-memoize";
import V1InstanceCache from './v1-instance-cache';
import V1App from './v1-app';
import walkSync from 'walk-sync';
import { writeFileSync, ensureDirSync, readFileSync } from 'fs-extra';
import { join, dirname, relative } from 'path';
import { compile } from './js-handlebars';
import { todo } from './messages';
import flatMap from 'lodash/flatmap';
import cloneDeep from 'lodash/cloneDeep';
import { JSDOM } from 'jsdom';

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
`);

class Options {
  extraPublicTrees?: Tree[];
}

export default class CompatApp implements App {
  private extraPublicTrees: Tree[] | undefined;
  private oldPackage: V1App;

  constructor(legacyEmberAppInstance: object, private workspace: Workspace, options?: Options) {
    if (options && options.extraPublicTrees) {
      this.extraPublicTrees = options.extraPublicTrees;
    }
    this.oldPackage = V1InstanceCache.forApp(legacyEmberAppInstance).app;
  }

  get root(): string {
    return this.workspace.appDestDir;
  }

  get tree(): Tree {
    let { workspace, appJS, analyzer, htmlTree, publicTree, configTree } = this;

    // todo: this should also take the public trees of each addon
    if (this.extraPublicTrees) {
      publicTree = mergeTrees([publicTree, ...this.extraPublicTrees]);
    }

    let inTrees: TreeNames<Tree> = {
      workspace,
      appJS,
      analyzer,
      htmlTree,
      publicTree,
      configTree,
    };

    // And we generate the actual entrypoint files.
    let entry = new AppEntry(this.build.bind(this), inTrees);

    return new WorkspaceUpdater([publicTree, appJS, entry], this.workspace);
  }

  @Memoize()
  private get activeAddonDescendants(): EmberPackage[] {
    // todo: filter by addon-provided hook
    return this.workspace.app.findDescendants(dep => dep.isEmberPackage) as EmberPackage[];
  }

  private get autoRun(): boolean {
    return this.oldPackage.autoRun;
  }

  private get isModuleUnification(): boolean {
    return this.oldPackage.isModuleUnification;
  }

  private scriptPriority(pkg: Package) {
    switch (pkg.name) {
      case 'loader.js':
        return 0;
      case 'ember-source':
        return 10;
      default:
        return 1000;
    }
  }

  private assets(originalBundle: string): any {
    let group: 'appJS' | 'appCSS' | 'testJS' | 'testCSS';
    let metaKey: 'implicit-scripts' | 'implicit-styles' | 'implicit-test-scripts' | 'implicit-test-styles';
    switch (originalBundle) {
      case 'vendor.js':
        group = 'appJS';
        metaKey = 'implicit-scripts';
        break;
      case 'vendor.css':
        group = 'appCSS';
        metaKey = 'implicit-styles';
        break;
      case 'test-support.js':
        group = 'testJS';
        metaKey = 'implicit-test-scripts';
        break;
      case 'test-support.css':
        group = 'testCSS';
        metaKey = 'implicit-test-styles';
        break;
      default:
        throw new Error(`unimplemented originalBundle ${originalBundle}`);
    }
    let result = [];
    for (let addon of sortBy(this.activeAddonDescendants, this.scriptPriority.bind(this))) {
      let implicitScripts = addon.packageJSON['ember-addon'][metaKey];
      if (implicitScripts) {
        for (let mod of implicitScripts) {
          result.push(resolve.sync(mod, { basedir: addon.root }));
        }
      }
    }
    let imports = new TrackedImports(this.workspace.app.name, this.oldPackage.trackedImports);
    for (let mod of imports.categorized[group]) {
      result.push(resolve.sync(mod, { basedir: this.root }));
    }

    // This file gets created by app-entrypoint.ts. We need to insert it at the
    // beginning of the scripts.
    if (originalBundle === 'vendor.js') {
      result.unshift(join(this.root, '_ember_env_.js'));
    }

    return result;
  }

  @Memoize()
  private get babelConfig() {
    let rename = Object.assign({}, ...this.activeAddonDescendants.map(dep => dep.packageJSON['ember-addon']['renamed-modules']));
    return this.oldPackage.babelConfig(this.root, rename);
  }

  private get configTree(): ConfigTree {
    return this.oldPackage.config;
  }

  private updateHTML(entrypoint: string, dom: JSDOM) {
    let scripts = [...dom.window.document.querySelectorAll('script')];
    this.updateAppJS(entrypoint, scripts);
    this.updateTestJS(entrypoint, scripts);
    this.updateJS(dom, entrypoint, this.oldPackage.findVendorScript(scripts), 'vendor.js');
    this.updateJS(dom, entrypoint, this.oldPackage.findTestSupportScript(scripts), 'test-support.js');

    let styles = [...dom.window.document.querySelectorAll('link[rel="stylesheet"]')] as HTMLLinkElement[];
    this.updateAppCSS(entrypoint, styles);
    this.updateCSS(dom, entrypoint, this.oldPackage.findVendorStyles(styles), 'vendor.css');
    this.updateCSS(dom, entrypoint, this.oldPackage.findTestSupportStyles(styles), 'test-support.css');
  }

  private updateAppJS(entrypoint: string, scripts: HTMLScriptElement[]) {
    // no custom name allowed here -- we're standardizing. It's not the final
    // output anyway, that will be up to the final stage packager. We also
    // switch to module type, to convey that we're going to point at an ES
    // module.
    let appJS = this.oldPackage.findAppScript(scripts);
    if (appJS) {
      appJS.src = relative(dirname(join(this.root, entrypoint)), join(this.root, `assets/${this.workspace.app.name}.js`));
      appJS.type = "module";
    }
  }

  private updateTestJS(entrypoint: string, scripts: HTMLScriptElement[]) {
    let testJS = this.oldPackage.findTestScript(scripts);
    if (testJS) {
      testJS.src = relative(dirname(join(this.root, entrypoint)), join(this.root, `assets/test.js`));
      testJS.type = "module";
    }
  }

  private updateJS(dom: JSDOM, entrypoint: string, original: HTMLScriptElement | undefined, bundleName: string) {
    // the vendor.js file gets replaced with each of our implicit scripts. It's
    // up to the final stage packager to worry about concatenation.
    if (!original) { return; }
    for (let insertedScript of this.assets(bundleName)) {
      let s = dom.window.document.createElement('script');
      s.src = relative(dirname(join(this.root, entrypoint)), insertedScript);
      // these newlines make the output more readable
      original.parentElement!.insertBefore(dom.window.document.createTextNode("\n"), original);
      original.parentElement!.insertBefore(s, original);
    }
    original.remove();
  }

  private updateAppCSS(entrypoint: string, styles: HTMLLinkElement[]) {
    // no custom name allowed here. Same argument applies here as for appJS
    // above.
    let appCSS = this.oldPackage.findAppStyles(styles);
    if (appCSS) {
      appCSS.href = relative(dirname(join(this.root, entrypoint)), join(this.root, `assets/${this.workspace.app.name}.css`));
    }
  }

  private updateCSS(dom: JSDOM, entrypoint: string, original: HTMLLinkElement | undefined, bundleName: string) {
    // the vendor.css file gets replaced with each of our implicit CSS
    // dependencies. It's up to the final stage packager to worry about
    // concatenation.
    if (!original) { return; }
    for (let insertedStyle of this.assets(bundleName)) {
      let s = dom.window.document.createElement('link');
      s.rel = 'stylesheet';
      s.href = relative(dirname(join(this.root, entrypoint)), insertedStyle);
      original.parentElement!.insertBefore(dom.window.document.createTextNode("\n"), original);
      original.parentElement!.insertBefore(s, original);
    }
    original.remove();
  }

  private get appJS() {
    return this.processAppJS().appJS;
  }

  private get analyzer() {
    return this.processAppJS().analyzer;
  }

  private get htmlTree() {
    return this.oldPackage.htmlTree;
  }

  private get publicTree() {
    return this.oldPackage.publicTree;
  }

  @Memoize()
  private processAppJS() {
    let appJSFromAddons = this.activeAddonDescendants.map(d => d.legacyAppTree).filter(Boolean) as Tree[];
    return this.oldPackage.processAppJS(appJSFromAddons, this.workspace.app.packageJSON);
  }

  // todo
  private shouldBuildTests = true;

  private emberEntrypoints() {
    let entrypoints = ['index.html'];
    if (this.shouldBuildTests) {
      entrypoints.push('tests/index.html');
    }
    return entrypoints;
  }

  private async build(inputPaths: TreeNames<string>, outputPath: string) {
    // readConfig timing is safe here because app.configTree is in our input trees.
    let config = this.configTree.readConfig();

    this.writeAppJS(inputPaths.appJS, config, outputPath);
    this.writeTestJS(inputPaths.appJS, outputPath);
    this.addTemplateCompiler(outputPath);
    this.addBabelConfig(outputPath);
    this.addEmberEnv(config.EmberENV, outputPath);

    // we are safe to access each addon.packageJSON because the Workspace is in
    // our inputTrees, so we know we are only running after any v1 packages have
    // already been build as v2.
    let externals = new Set(flatMap(this.activeAddonDescendants, addon => addon.packageJSON['ember-addon'].externals || []));

    // similarly, we're safe to access analyzer.externals because the analyzer
    // is one of our input trees.
    this.analyzer.externals.forEach(name => externals.add(name));

    // This is the publicTree we were given. We need to list all the files in
    // here as "entrypoints", because an "entrypoint" is anything that is
    // guaranteed to have a valid URL in the final build output.
    let entrypoints = walkSync(inputPaths.publicTree, {
      directories: false
    });

    let rawPkg = cloneDeep(this.workspace.app.packageJSON);
    if (!rawPkg['ember-addon']) {
      rawPkg['ember-addon'] = {};
    }
    let pkg = rawPkg as AppPackageJSON;
    pkg['ember-addon'].externals = [...externals.values()];
    pkg['ember-addon'].entrypoints = this.emberEntrypoints().concat(entrypoints);
    pkg['ember-addon']['template-compiler'] = '_template_compiler_.js';
    pkg['ember-addon']['babel-config'] = '_babel_config_.js';
    writeFileSync(join(outputPath, 'package.json'), JSON.stringify(pkg, null, 2), 'utf8');

    this.rewriteHTML(inputPaths.htmlTree, outputPath);
  }

  // we could just use ember-source/dist/ember-template-compiler directly, but
  // apparently ember-cli adds some extra steps on top (like stripping BOM), so
  // we follow along and do those too.
  private addTemplateCompiler(outputPath: string) {
    writeFileSync(join(outputPath, '_template_compiler_.js'), `
    var compiler = require('ember-source/vendor/ember/ember-template-compiler');
    var setupCompiler = require('@embroider/core/src/template-compiler').default;
    module.exports = setupCompiler(compiler);
    `, 'utf8');
  }

  private addBabelConfig(outputPath: string) {
    writeFileSync(join(outputPath, '_babel_config_.js'), `
    module.exports = ${JSON.stringify(this.babelConfig, null, 2)};
    `, 'utf8');
  }

  // this is stuff that needs to get set globally before Ember loads. In classic
  // Ember CLI is was "vendor-prefix" content that would go at the start of the
  // vendor.js. We are going to make sure it's the first plain <script> in the
  // HTML that we hand to the final stage packager.
  private addEmberEnv(config: any, outputPath: string) {
    writeFileSync(join(outputPath, '_ember_env_.js'), `
    window.EmberENV=${JSON.stringify(config, null, 2)};
    `, 'utf8');
  }

  private rewriteHTML(htmlTreePath: string, outputPath: string) {
    for (let entrypoint of  this.emberEntrypoints()) {
      let dom = new JSDOM(readFileSync(join(htmlTreePath, entrypoint), 'utf8'));
      this.updateHTML(entrypoint, dom);
      let outputFile = join(outputPath, entrypoint);
      ensureDirSync(dirname(outputFile));
      writeFileSync(outputFile, dom.serialize(), 'utf8');
    }
  }

  private writeAppJS(appJSTreePath: string, config: any, outputPath: string) {
    let mainModule = join(outputPath, this.isModuleUnification ? 'src/main' : 'app');
    // standard JS file name, not customizable. It's not final anyway (that is
    // up to the final stage packager). See also updateHTML in app.ts for where
    // we're enforcing this in the HTML.
    let appJS = join(outputPath, `assets/${this.workspace.app.name}.js`);

    // for the app tree, we take everything
    let lazyModules = walkSync(appJSTreePath, {
      globs: ['**/*.{js,hbs}'],
      ignore: ['tests/**'],
      directories: false
    }).map(specifier => {
      let noJS = specifier.replace(/\.js$/, '');
      let noHBS = noJS.replace(/\.hbs$/, '');
      return {
        runtime: `${config.modulePrefix}/${noHBS}`,
        buildtime: `../${noJS}`
      };
    });

    // for the src tree, we can limit ourselves to only known resolvable
    // collections
    todo("app src tree");

    // this is a backward-compatibility feature: addons can force inclusion of
    // modules.
    for (let addon of this.activeAddonDescendants) {
      let implicitModules = addon.packageJSON['ember-addon']['implicit-modules'];
      if (implicitModules) {
        for (let name of implicitModules) {
          lazyModules.push({
            runtime: `${addon.name}/${name}`,
            buildtime: relative(join(this.root, 'assets'), `${addon.root}/${name}`)
          });
        }
      }
    }
    ensureDirSync(dirname(appJS));
    writeFileSync(appJS, entryTemplate({
      lazyModules,
      autoRun: this.autoRun,
      mainModule: relative(dirname(appJS), mainModule),
      appConfig: config.APP
    }), 'utf8');
  }

  private writeTestJS(appJSTreePath: string, outputPath: string) {
    let testJS = join(outputPath, `assets/test.js`);
    let testModules = walkSync(appJSTreePath, {
      globs: ['tests/**/*-test.js'],
      directories: false
    }).map(specifier => `../${specifier}`);
    ensureDirSync(dirname(testJS));
    writeFileSync(testJS, testTemplate({
      testModules
    }), 'utf8');
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

class AppEntry extends BroccoliPlugin {
  constructor(
    private buildHook: (trees: TreeNames<string>, outputPath: string) => Promise<void>,
    private trees: TreeNames<Tree>
  ){
    super(Object.values(trees), {});
  }

  async build() {
    let treeNames = Object.keys(this.trees);
    let inputPathsByName: { [treeName: string]: string } = {};
    for (let i = 0; i < this.inputPaths.length; i++) {
      inputPathsByName[treeNames[i]] = this.inputPaths[i];
    }
    return this.buildHook(inputPathsByName as unknown as TreeNames<string>, this.outputPath);
  }
}
