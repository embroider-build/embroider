import Package from './package';
import { Memoize } from 'typescript-memoize';
import { join, dirname } from 'path';
import { sync as pkgUpSync }  from 'pkg-up';
import { existsSync } from 'fs-extra';
import makeDebug from 'debug';
import Funnel from 'broccoli-funnel';
import { UnwatchedDir } from 'broccoli-source';
import DependencyAnalyzer from './dependency-analyzer';
import RewritePackageJSON from './rewrite-package-json';

const todo = makeDebug('ember-cli-vanilla:todo');

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

export default class AddonPackage extends Package {
  constructor(private addonInstance) {
    super();
  }

  get name() : string {
    return this.addonInstance.pkg.name;
  }

  get directAddons() {
    return this.addonInstance.addons;
  }

  protected get trackedImports() {
    return this.addonInstance._trackedImports;
  }

  preprocessJS(tree) {
    return this.addonInstance.preprocessJs(tree, '/', this.addonInstance.name, { registry : this.addonInstance.registry });
  }

  // addonInstance.root gets modified by a customized "main" or
  // "ember-addon.main" in package.json. We want the real package root here
  // (the place where package.json lives).
  @Memoize()
  private get root(): string {
    return dirname(pkgUpSync(this.addonInstance.root));
  }

  @Memoize()
  private get mainModule() {
    return require(this.addonInstance.constructor._meta_.modulePath);
  }

  protected get options() {
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

  protected v2Trees() {
    let trees = [];
    let importParsers = [];

    {
      let tree = this.implicitImportTree();
      if (tree) {
        trees.push(tree);
      }
    }

    if (this.customizes('treeFor')) {
      todo(`${this.name} has customized treeFor`);
      return trees;
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
      let tree = this.transpile(this.stockTree('app', {
        exclude: ['styles/**'],
        destDir: '_app_'
      }));
      importParsers.push(this.parseImports(tree));
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

    let analyzer = new DependencyAnalyzer(importParsers, this.addonInstance.pkg, false );
    trees.push(new RewritePackageJSON(this.rootTree, analyzer));
    return trees;
  }
}
