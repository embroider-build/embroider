import V1Package from "./v1-package";
import { Memoize } from 'typescript-memoize';
import { dirname } from 'path';
import { sync as pkgUpSync }  from 'pkg-up';
import { join } from 'path';
import { existsSync } from 'fs-extra';
import Funnel from 'broccoli-funnel';
import { UnwatchedDir } from 'broccoli-source';
import DependencyAnalyzer from './dependency-analyzer';
import RewritePackageJSON from './rewrite-package-json';
import { todo } from './messages';
import { trackedImportTree } from './tracked-imports';
import quickTemp from 'quick-temp';
import { updateBabelConfig } from './babel-config';
import ImportParser from './import-parser';
import { Tree } from "broccoli-plugin";

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

// This controls and types the interface between our new world and the classic
// v1 addon instance.
export default class V1Addon implements V1Package {
  constructor(private addonInstance, public parent: V1Package) {
  }

  get name() {
    return this.addonInstance.pkg.name;
  }

  @Memoize()
  get root(): string {
    // addonInstance.root gets modified by a customized "main" or
    // "ember-addon.main" in package.json. We want the real package root here
    // (the place where package.json lives).
    return dirname(pkgUpSync(this.addonInstance.root));
  }

  private parseImports(tree) {
    return new ImportParser(tree);
  }

  @Memoize()
  private get mainModule() {
    return require(this.addonInstance.constructor._meta_.modulePath);
  }

  private get options() {
    return this.addonInstance.options;
  }

  private customizes(...treeNames) {
    return treeNames.find(treeName => this.mainModule[treeName]);
  }

  @Memoize()
  private hasStockTree(treeName) {
    return this.addonInstance.treePaths && existsSync(join(this.root, this.addonInstance.treePaths[treeName]));
  }

  hasAnyTrees() : boolean {
    return Boolean(stockTreeNames.find(name => this.hasStockTree(name)));
  }

  private stockTree(treeName, funnelOpts?) {
    let opts = Object.assign({
      srcDir: this.addonInstance.treePaths[treeName]
    }, funnelOpts);
    return new Funnel(this.rootTree, opts);
  }

  @Memoize()
  private get rootTree() {
    return new UnwatchedDir(this.root);
  }

  private transpile(tree) {
    this.updateBabelConfig();
    return this.addonInstance.preprocessJs(tree, '/', this.addonInstance.name, { registry : this.addonInstance.registry });
  }

  @Memoize()
  private updateBabelConfig() {
    // auto-import gets disabled because we support it natively
    this.addonInstance.registry.remove('js', 'ember-auto-import-analyzer');

    updateBabelConfig(this.name, this.options, this.addonInstance.addons.find(a => a.name === 'ember-cli-babel'));
  }

  @Memoize()
  get v2Trees() {
    let { trees, importParsers, appJSPath } = this.legacyTrees();
    let analyzer = new DependencyAnalyzer(importParsers, this.addonInstance.pkg, false );
    trees.push(new RewritePackageJSON(this.rootTree, analyzer, appJSPath));
    return trees;
  }

  private legacyTrees() : { trees: Tree[], importParsers: ImportParser[], appJSPath: string|undefined } {
    let trees = [];
    let importParsers = [];
    let appJSPath;

    {
      quickTemp.makeOrRemake(this, 'trackedImportDir');
      let tree = trackedImportTree(this.name, this.addonInstance._trackedImports, (this as any).trackedImportDir);
      if (tree) {
        trees.push(tree);
      }
    }

    if (this.customizes('treeFor')) {
      todo(`${this.name} has customized treeFor`);
      return { trees, importParsers, appJSPath };
    }

    if (this.customizes('treeForAddon', 'treeForAddonTemplates')) {
      todo(`${this.name} may have customized the addon tree`);
    } else if (this.hasStockTree('addon')) {
      let tree = this.transpile(this.stockTree('addon', {
        exclude: ['styles/**']
      }));
      importParsers.push(this.parseImports(tree));
      trees.push(tree);
    }

    if (this.customizes('treeForAddonStyles')) {
      todo(`${this.name} may have customized the addon style tree`);
    } else if (this.hasStockTree('addon-styles')) {
      // TODO should generate `import "this-addon/addon.css";` to maintain
      // auto inclusion semantics.
      trees.push(
        this.transpile(this.stockTree('addon-styles'))
      );
    }

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
      trees.push(
        this.transpile(this.stockTree('styles', {
          destDir: '_app_styles_'
        }))
      );
    }

    if (this.customizes('treeForAddonTestSupport')) {
      todo(`${this.name} may have customized the addon test support tree`);
    } else if (this.hasStockTree('addon-test-support')) {
      let tree = this.transpile(this.stockTree('addon-test-support', {
        destDir: 'test-support'
      }));
      importParsers.push(this.parseImports(tree));
      trees.push(tree);
    }

    if (this.customizes('treeForTestSupport')) {
      todo(`${this.name} may have customized the test support tree`);
    } else if (this.hasStockTree('test-support')) {
      // this case should probably get deprecated entirely, there's no good
      // reason to use this over addon-test-support.
      todo(`${this.name} is using test-support instead of addon-test-support`);
    }

    if (this.customizes('treeForApp', 'treeForTemplates')) {
      todo(`${this.name} may have customized the app tree`);
    } else if (this.hasStockTree('app')) {
      // this one doesn't go through parseImports and transpile yet because it
      // gets handled as part of the consuming app. For example, imports should
      // be relative to the consuming app, not our own package. That is some of
      // what is lame about app trees and why they will go away once everyone is
      // all MU.
      appJSPath = '_app_';
      let tree = this.stockTree('app', {
        exclude: ['styles/**'],
        destDir: appJSPath
      });
      trees.push(tree);
    }

    if (this.customizes('treeForPublic')) {
      // TODO: The stock behavior for public is that the files get automatically
      // namespaced under your package name before merging into the final app.
      // But people who are customizing have the ability to sidestep that
      // behavior. So here we need to monitor them for good behavior.
      let tree = this.addonInstance._treeFor('public');
      if (tree) {
        trees.push(
          new Funnel(tree, {
            destDir: 'public'
          })
        );
      }
    } else if (this.hasStockTree('public')) {
      trees.push(
        this.stockTree('public', {
          destDir: 'public'
        })
      );
    }

    if (this.customizes('treeForVendor')) {
      // We don't have any particular opinions about the structure inside
      // vendor, so even when it's customized we can just use the customized
      // one.
      let tree = this.addonInstance._treeFor('vendor');
      if (tree) {
        trees.push(
          new Funnel(tree, {
            destDir: 'vendor'
          })
        );
      }
    } else if (this.hasStockTree('vendor')) {
      trees.push(
        this.stockTree('vendor', {
          destDir: 'vendor'
        })
      );
    }

    return { trees, importParsers, appJSPath };
  }
}
