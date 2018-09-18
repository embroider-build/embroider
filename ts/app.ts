import V1InstanceCache from './v1-instance-cache';
import { Tree } from 'broccoli-plugin';
import AppEntrypoint from './app-entrypoint';
import Package from './package';
import V1App from './v1-app';
import PackageCache from './package-cache';
import Workspace from './workspace';
import WorkspaceUpdater from './workspace-updater';
import { tmpdir } from 'os';
import { join, relative, dirname } from 'path';
import { mkdtempSync, realpathSync } from 'fs';
import { Packager } from './packager';
import PackagerRunner from './packager-runner';
import { V1AddonConstructor } from './v1-addon';
import get from 'lodash/get';
import { TrackedImports } from './tracked-imports';
import resolve from 'resolve';
import Addon from './addon';
import sortBy from 'lodash/sortBy';
import { Memoize } from 'typescript-memoize';

class Options {
  legacyAppInstance?: any;
  workspaceDir?: string;
  compatAdapters?: Map<string, V1AddonConstructor>;
  emitNewRoot?: (path: string) => void;
}

export default class App extends Package {
  private oldPackage: V1App;
  protected packageCache: PackageCache;
  private workspaceDir: string;

  constructor(public originalRoot: string, options?: Options) {
    super(originalRoot, options ? options.emitNewRoot: null);

    let v1Cache: V1InstanceCache | undefined;
    if (options && options.legacyAppInstance) {
      v1Cache = new V1InstanceCache(options.legacyAppInstance);
      this.oldPackage = v1Cache.app;
      if (options.compatAdapters) {
        for (let [packageName, adapter] of options.compatAdapters) {
          v1Cache.registerCompatAdapter(packageName, adapter);
        }
      }
    } else {
      throw new Error("Constructing a vanilla app without a legacyAppInstance is not yet implemented");
    }

    this.packageCache = new PackageCache(v1Cache);

    if (options && options.workspaceDir) {
      this.workspaceDir = realpathSync(options.workspaceDir);
    } else {
      this.workspaceDir = mkdtempSync(join(tmpdir(), 'ember-cli-vanilla-'));
    }
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

  private scripts(entrypoint): any {
    let group;
    switch (entrypoint) {
      case 'index.html':
        group = 'app';
        break;
      case 'tests/index.html':
        group = 'test';
        break;
      default:
        throw new Error(`unimplemented entrypoint ${entrypoint}`);
    }
    let result = [];
    for (let addon of sortBy(this.activeDescendants, this.scriptPriority.bind(this))) {
      let implicitScripts = get(addon.packageJSON, `ember-addon.implicit-${group === 'test' ? 'test-' : ''}scripts`);
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
    return result;
  }

  // This is the end of the Vanilla build pipeline -- this is the tree you want
  // to make broccoli build, though the actual output will appear in
  // `this.outputPath` instead. See workspace.ts for explanation.
  get vanillaTree(): Tree {
    let workspace = new Workspace(this, this.workspaceDir);

    // We need to smoosh all the app trees together. This is unavoidable until
    // everybody goes MU.
    let appJSFromAddons = this.activeDescendants.map(d => d.legacyAppTree).filter(Boolean);
    let { appJS, analyzer } = this.oldPackage.processAppJS(appJSFromAddons, this.originalPackageJSON);

    // The oldPackage provides us with the HTML as built by a classic app (for
    // example, contentFor is already handled). That serves as input to our
    // AppEntrypoint builder which will rewrite it further.
    let htmlTree = this.oldPackage.htmlTree;
    let updateHTML = this.updateHTML.bind(this);

    // And we generate the actual entrypoint files.
    let entry = new AppEntrypoint(workspace, appJS, htmlTree, this, analyzer, updateHTML);

    return new WorkspaceUpdater([appJS, entry], workspace);
  }

  packageWith(packagerClass: Packager): Tree {
    return new PackagerRunner(packagerClass, this);
  }

  protected dependencyKeys = ['dependencies', 'devDependencies'];

  get dependedUponBy() {
    return new Set();
  }

  @Memoize()
  get babelConfig() {
    return this.oldPackage.babelConfig(this.root);
  }

  get configTree(): ConfigTree {
    return this.oldPackage.config;
  }

  // this encapsulates API that the AppEntrypoint needs from App that we don't
  // want to make public for everyone else.
  private updateHTML(entrypoint: string, dom) {
    let scripts = [...dom.window.document.querySelectorAll('script')];

    // no custom name allowed here -- we're standardizing. It's not the final
    // output anyway, that will be up to the final stage packager. We also
    // switch to module type, to convey that we're going to point at an ES
    // module.
    let appJS = this.oldPackage.findAppScript(scripts);
    appJS.src = `assets/${this.name}.js`;
    appJS.type = "module";

    // the vendor.js file gets replaced with each of our implicit scripts. It's
    // up to the final stage packager to worry about concatenation.
    let vendorJS = this.oldPackage.findVendorScript(scripts);
    for (let insertedScript of this.scripts(entrypoint)) {
      let s = dom.window.document.createElement('script');
      s.src = relative(dirname(join(this.root, entrypoint)), insertedScript);
      vendorJS.parentElement.insertBefore(s, vendorJS);
    }
    vendorJS.remove();
  }
}

export interface ConfigTree extends Tree {
  readConfig: () => any;
}
