import { Memoize } from "typescript-memoize";
import V1InstanceCache from "./v1-instance-cache";
import Package, { EmberPackage } from './package';
import MovedPackageCache from "./moved-package-cache";
import V1App from "./v1-app";
import sortBy from 'lodash/sortBy';
import resolve from 'resolve';
import { TrackedImports } from './tracked-imports';
import { join, relative, dirname } from 'path';
import { Tree } from 'broccoli-plugin';
import { JSDOM } from 'jsdom';

export default class MovingApp extends Package {
  // gets set externally when the MovedPackageCache is constructed
  moved!: MovedPackageCache;

  constructor(
    readonly destRoot: string,
    private originalPackage: Package,
    private v1Cache: V1InstanceCache,
  ) {
    super();
  }

  get root() {
    return this.originalPackage.root;
  }

  private get oldPackage(): V1App {
    return this.v1Cache.app;
  }

  get name(): string {
    return this.oldPackage.name;
  }

  get packageJSON(): any {
    throw new Error(`MovingApp doesn't have its final packageJSON available at this stage`);
  }

  get originalPackageJSON(): any {
    return this.originalPackage.packageJSON;
  }

  get dependencies(): Package[] {
    return this.originalPackage.dependencies.map(dep => this.moved.getPackage(dep.root, this));
  }

  get activeAddonDependencies(): EmberPackage[] {
    // todo: filter by addon-provided hook
    return this.dependencies.filter(dep => dep.isEmberPackage) as EmberPackage[];
  }

  @Memoize()
  get activeAddonDescendants(): EmberPackage[] {
    // todo: filter by addon-provided hook
    return this.findDescendants(dep => dep.isEmberPackage) as EmberPackage[];
  }

  get autoRun(): boolean {
    return this.oldPackage.autoRun;
  }

  get isModuleUnification(): boolean {
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
    let imports = new TrackedImports(this.name, this.oldPackage.trackedImports);
    for (let mod of imports.categorized[group]) {
      result.push(resolve.sync(mod, { basedir: this.destRoot }));
    }

    // This file gets created by app-entrypoint.ts. We need to insert it at the
    // beginning of the scripts.
    if (originalBundle === 'vendor.js') {
      result.unshift(join(this.destRoot, '_ember_env_.js'));
    }

    return result;
  }
  @Memoize()
  get babelConfig() {
    let rename = Object.assign({}, ...this.activeAddonDescendants.map(dep => dep.packageJSON['ember-addon']['renamed-modules']));
    return this.oldPackage.babelConfig(this.destRoot, rename);
  }

  get configTree(): ConfigTree {
    return this.oldPackage.config;
  }

  // this encapsulates API that the AppEntrypoint needs from App that we don't
  // want to make public for everyone else.
  updateHTML(entrypoint: string, dom: JSDOM) {
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
      appJS.src = relative(dirname(join(this.destRoot, entrypoint)), join(this.destRoot, `assets/${this.name}.js`));
      appJS.type = "module";
    }
  }

  private updateTestJS(entrypoint: string, scripts: HTMLScriptElement[]) {
    let testJS = this.oldPackage.findTestScript(scripts);
    if (testJS) {
      testJS.src = relative(dirname(join(this.destRoot, entrypoint)), join(this.destRoot, `assets/test.js`));
      testJS.type = "module";
    }
  }

  private updateJS(dom: JSDOM, entrypoint: string, original: HTMLScriptElement | undefined, bundleName: string) {
    // the vendor.js file gets replaced with each of our implicit scripts. It's
    // up to the final stage packager to worry about concatenation.
    if (!original) { return; }
    for (let insertedScript of this.assets(bundleName)) {
      let s = dom.window.document.createElement('script');
      s.src = relative(dirname(join(this.destRoot, entrypoint)), insertedScript);
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
      appCSS.href = relative(dirname(join(this.destRoot, entrypoint)), join(this.destRoot, `assets/${this.name}.css`));
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
      s.href = relative(dirname(join(this.destRoot, entrypoint)), insertedStyle);
      original.parentElement!.insertBefore(dom.window.document.createTextNode("\n"), original);
      original.parentElement!.insertBefore(s, original);
    }
    original.remove();
  }

  get appJS() {
    return this.processAppJS().appJS;
  }

  get analyzer() {
    return this.processAppJS().analyzer;
  }

  get htmlTree() {
    return this.oldPackage.htmlTree;
  }

  get publicTree() {
    return this.oldPackage.publicTree;
  }

  @Memoize()
  private processAppJS() {
    let appJSFromAddons = this.activeAddonDescendants.map(d => d.legacyAppTree).filter(Boolean) as Tree[];
    return this.oldPackage.processAppJS(appJSFromAddons, this.originalPackage.packageJSON);
  }
}

export interface ConfigTree extends Tree {
  readConfig: () => any;
}
