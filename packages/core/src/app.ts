import V1InstanceCache from './v1-instance-cache';
import { Tree } from 'broccoli-plugin';
import AppEntrypoint from './app-entrypoint';
import CompatPackage from './compat-package';
import V1App from './v1-app';
import PackageCache from './package-cache';
import CompatWorkspace from './compat-workspace';
import WorkspaceUpdater from './workspace-updater';
import { tmpdir } from 'os';
import { join, relative, dirname } from 'path';
import { mkdtempSync, ensureDirSync, realpathSync } from 'fs-extra';
import { Packager } from './packager';
import PackagerRunner from './packager-runner';
import { V1AddonConstructor } from './v1-addon';
import get from 'lodash/get';
import { TrackedImports } from './tracked-imports';
import resolve from 'resolve';
import Addon from './addon';
import sortBy from 'lodash/sortBy';
import { Memoize } from 'typescript-memoize';
import mergeTrees from 'broccoli-merge-trees';
import Package from './package';
import CompatPackageCache from './compat-package-cache';

class Options {
  legacyAppInstance: any;
  workspaceDir?: string;
  compatAdapters?: Map<string, V1AddonConstructor>;
  emitNewRoot?: (path: string) => void;
  extraPublicTrees?: Tree[];
}

export default class App implements CompatPackage {
  private oldPackage: V1App;
  private workspaceDir: string;
  private extraPublicTrees: Tree[] | undefined;
  private emitNewRoot: ((message: string) => void) | undefined;
  private compatCache: CompatPackageCache;

  static create(rootDir: string, options: Options) {
    let packageCache = new PackageCache();
    let v1Cache = new V1InstanceCache(options.legacyAppInstance);
    return new this(packageCache.getPackage(rootDir), v1Cache, options);
  }

  constructor(private pkg: Package, v1Cache: V1InstanceCache, options?: Options) {
    this.compatCache = new CompatPackageCache(v1Cache, pkg, this);
    this.packageAsAddon = this.packageAsAddon.bind(this);

    this.oldPackage = v1Cache.app;
    if (options.compatAdapters) {
      for (let [packageName, adapter] of options.compatAdapters) {
        v1Cache.registerCompatAdapter(packageName, adapter);
      }
    }

    if (options && options.workspaceDir) {
      ensureDirSync(options.workspaceDir);
      this.workspaceDir = realpathSync(options.workspaceDir);
    } else {
      this.workspaceDir = mkdtempSync(join(tmpdir(), 'embroider-'));
    }

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

  private assets(originalBundle): any {
    let group, metaKey;
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
      let implicitScripts = get(addon.packageJSON, `ember-addon.${metaKey}`);
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
    let workspace = new CompatWorkspace(this, this.workspaceDir);

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
    let rename = Object.assign({}, ...this.activeDescendants.map(dep => get(dep.packageJSON, 'ember-addon.renamed-modules')));
    return this.oldPackage.babelConfig(this.root, rename);
  }

  get configTree(): ConfigTree {
    return this.oldPackage.config;
  }

  // this encapsulates API that the AppEntrypoint needs from App that we don't
  // want to make public for everyone else.
  private updateHTML(entrypoint: string, dom) {
    let scripts = [...dom.window.document.querySelectorAll('script')];
    this.updateAppJS(entrypoint, scripts);
    this.updateTestJS(entrypoint, scripts);
    this.updateJS(dom, entrypoint, this.oldPackage.findVendorScript(scripts), 'vendor.js');
    this.updateJS(dom, entrypoint, this.oldPackage.findTestSupportScript(scripts), 'test-support.js');

    let styles = [...dom.window.document.querySelectorAll('link[rel="stylesheet"]')];
    this.updateAppCSS(entrypoint, styles);
    this.updateCSS(dom, entrypoint, this.oldPackage.findVendorStyles(styles), 'vendor.css');
    this.updateCSS(dom, entrypoint, this.oldPackage.findTestSupportStyles(styles), 'test-support.css');
  }

  private updateAppJS(entrypoint, scripts) {
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

  private updateTestJS(entrypoint, scripts) {
    let testJS = this.oldPackage.findTestScript(scripts);
    if (testJS) {
      testJS.src = relative(dirname(join(this.root, entrypoint)), join(this.root, `assets/test.js`));
      testJS.type = "module";
    }
  }

  private updateJS(dom, entrypoint, original, bundleName) {
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

  private updateAppCSS(entrypoint, styles) {
    // no custom name allowed here. Same argument applies here as for appJS
    // above.
    let appCSS = this.oldPackage.findAppStyles(styles);
    if (appCSS) {
      appCSS.href = relative(dirname(join(this.root, entrypoint)), join(this.root, `assets/${this.name}.css`));
    }
  }

  private updateCSS(dom, entrypoint, original, bundleName) {
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
