import V1InstanceCache from './v1-instance-cache';
import { Tree } from 'broccoli-plugin';
import AppEntrypoint from './app-entrypoint';
import CompatPackage from './compat-package';
import V1App from './v1-app';
import CompatWorkspace from './compat-workspace';
import WorkspaceUpdater from './workspace-updater';
import { join, relative, dirname } from 'path';
import { Packager } from './packager';
import PackagerRunner from './packager-runner';
import { V1AddonConstructor } from './v1-addon';
import { TrackedImports } from './tracked-imports';
import resolve from 'resolve';
import Addon from './addon';
import sortBy from 'lodash/sortBy';
import { Memoize } from 'typescript-memoize';
import mergeTrees from 'broccoli-merge-trees';
import Package from './package';
import CompatPackageCache from './compat-package-cache';
import { JSDOM } from 'jsdom';
import Workspace from './workspace';

class Options {
  legacyAppInstance: any;
  workspaceDir?: string;
  compatAdapters?: Map<string, V1AddonConstructor>;
  emitNewRoot?: (path: string) => void;
  extraPublicTrees?: Tree[];
}

export default class App implements CompatPackage {
  private oldPackage: V1App;
  private extraPublicTrees: Tree[] | undefined;
  private emitNewRoot: ((message: string) => void) | undefined;
  private compatCache: CompatPackageCache;
  private pkg: Package;

  static create(_: string, options: Options) {
    let workspace = new CompatWorkspace(options.legacyAppInstance, {
      workspaceDir: options.workspaceDir,
      compatAdapters: options.compatAdapters
    });

    return new this(workspace, v1Cache, options);
  }

  private constructor(private workspace: Workspace, v1Cache: V1InstanceCache, options?: Options) {
    this.pkg = workspace.appSource;
    this.compatCache = new CompatPackageCache(v1Cache, this.pkg, this);
    this.packageAsAddon = this.packageAsAddon.bind(this);

    this.oldPackage = v1Cache.app;

    if (options && options.extraPublicTrees) {
      this.extraPublicTrees = options.extraPublicTrees;
    }

    if (options && options.emitNewRoot) {
      this.emitNewRoot = options.emitNewRoot;
    }
  }

  private packageAsAddon(pkg: Package): Addon {
    return this.compatCache.lookupAddon(pkg);
  }

  // This is all the NPM packages we depend on, as opposed to `dependencies`
  // which is just the Ember packages we depend on.
  get npmDependencies() {
    return this.pkg.dependencies.map(this.packageAsAddon);
  }

  get descendants(): Addon[] {
    return this.pkg.findDescendants(pkg => this.packageAsAddon(pkg).isEmberPackage).map(this.packageAsAddon);
  }

  get dependencies(): Addon[] {
    return this.pkg.dependencies.map(this.packageAsAddon).filter(pkg => pkg.isEmberPackage);
  }

  get originalPackageJSON() {
    return this.pkg.packageJSON;
  }

  get activeDependencies(): Addon[] {
    // todo: filter by addon-provided hook
    return this.dependencies;
  }

  @Memoize()
  get activeDescendants(): Addon[] {
    // todo: filter by addon-provided hook
    return this.descendants;
  }

  get originalRoot() {
    return this.pkg.root;
  }

  get name(): string {
    return this.oldPackage.name;
  }

  get autoRun(): boolean {
    return this.oldPackage.autoRun;
  }

  get isModuleUnification(): boolean {
    return this.oldPackage.isModuleUnification;
  }

  private privRoot: string | undefined;
  get root(): string {
    if (!this.privRoot) {
      throw new Error(`package ${this.name} does not know its final root location yet`);
    }
    return this.privRoot;
  }

  set root(value: string) {
    if (this.privRoot) {
      throw new Error(`double set of root in package ${this.name}`);
    }
    this.privRoot = value;
    if (this.emitNewRoot) {
      this.emitNewRoot(value);
    }
  }

  private scriptPriority(pkg: Addon) {
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
    for (let addon of sortBy(this.activeDescendants, this.scriptPriority.bind(this))) {
      let implicitScripts = addon.packageJSON['ember-addon'][metaKey];
      if (implicitScripts) {
        for (let mod of implicitScripts) {
          result.push(resolve.sync(mod, { basedir: addon.root }));
        }
      }
    }
    let imports = new TrackedImports(this.name, this.oldPackage.trackedImports);
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

  // This is the end of the Vanilla build pipeline -- this is the tree you want
  // to make broccoli build, though the actual output will appear in
  // `this.outputPath` instead. See workspace.ts for explanation.
  get vanillaTree(): Tree {
    let workspace = this.workspace;

    // We need to smoosh all the app trees together. This is unavoidable until
    // everybody goes MU.
    let appJSFromAddons = this.activeDescendants.map(d => d.legacyAppTree).filter(Boolean);
    let { appJS, analyzer } = this.oldPackage.processAppJS(appJSFromAddons, this.originalPackageJSON);

    // The oldPackage provides us with the HTML as built by a classic app (for
    // example, contentFor is already handled). That serves as input to our
    // AppEntrypoint builder which will rewrite it further.
    let htmlTree = this.oldPackage.htmlTree;
    let updateHTML = this.updateHTML.bind(this);

    // todo: this should also take the public trees of each addon
    let publicTree = this.oldPackage.publicTree;
    if (this.extraPublicTrees) {
      publicTree = mergeTrees([publicTree, ...this.extraPublicTrees]);
    }

    // And we generate the actual entrypoint files.
    let entry = new AppEntrypoint(workspace, appJS, htmlTree, publicTree, this, analyzer, updateHTML);

    return new WorkspaceUpdater([publicTree, appJS, entry], workspace);
  }

  packageWith(packagerClass: Packager): Tree {
    return new PackagerRunner(packagerClass, this);
  }

  get dependedUponBy() {
    return new Set();
  }

  @Memoize()
  get babelConfig() {
    let rename = Object.assign({}, ...this.activeDescendants.map(dep => dep.packageJSON['ember-addon']['renamed-modules']));
    return this.oldPackage.babelConfig(this.root, rename);
  }

  get configTree(): ConfigTree {
    return this.oldPackage.config;
  }

  // this encapsulates API that the AppEntrypoint needs from App that we don't
  // want to make public for everyone else.
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
      appJS.src = relative(dirname(join(this.root, entrypoint)), join(this.root, `assets/${this.name}.js`));
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

  private updateJS(dom: JSDOM, entrypoint: string, original: HTMLScriptElement, bundleName: string) {
    // the vendor.js file gets replaced with each of our implicit scripts. It's
    // up to the final stage packager to worry about concatenation.
    if (!original) { return; }
    for (let insertedScript of this.assets(bundleName)) {
      let s = dom.window.document.createElement('script');
      s.src = relative(dirname(join(this.root, entrypoint)), insertedScript);
      // these newlines make the output more readable
      original.parentElement.insertBefore(dom.window.document.createTextNode("\n"), original);
      original.parentElement.insertBefore(s, original);
    }
    original.remove();
  }

  private updateAppCSS(entrypoint: string, styles: HTMLLinkElement[]) {
    // no custom name allowed here. Same argument applies here as for appJS
    // above.
    let appCSS = this.oldPackage.findAppStyles(styles);
    if (appCSS) {
      appCSS.href = relative(dirname(join(this.root, entrypoint)), join(this.root, `assets/${this.name}.css`));
    }
  }

  private updateCSS(dom: JSDOM, entrypoint: string, original: HTMLLinkElement, bundleName: string) {
    // the vendor.css file gets replaced with each of our implicit CSS
    // dependencies. It's up to the final stage packager to worry about
    // concatenation.
    if (!original) { return; }
    for (let insertedStyle of this.assets(bundleName)) {
      let s = dom.window.document.createElement('link');
      s.rel = 'stylesheet';
      s.href = relative(dirname(join(this.root, entrypoint)), insertedStyle);
      original.parentElement.insertBefore(dom.window.document.createTextNode("\n"), original);
      original.parentElement.insertBefore(s, original);
    }
    original.remove();
  }
}

export interface ConfigTree extends Tree {
  readConfig: () => any;
}
