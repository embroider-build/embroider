import mergeTrees from 'broccoli-merge-trees';
import Funnel from 'broccoli-funnel';
import { UnwatchedDir } from 'broccoli-source';
import { Tree } from 'broccoli-plugin';
import { existsSync, writeFileSync } from 'fs-extra';
import { join, dirname } from 'path';
import RewritePackageJSON from './rewrite-package-json';
import { sync as pkgUpSync }  from 'pkg-up';
import { Memoize } from 'typescript-memoize';
import makeDebug from 'debug';
import quickTemp from 'quick-temp';
import { compile, registerHelper } from 'handlebars';
import jsStringEscape from 'js-string-escape';
import ImportParser from './import-parser';
import DependencyAnalyzer from './dependency-analyzer';

registerHelper('js-string-escape', jsStringEscape);

const todo = makeDebug('ember-cli-vanilla:todo');

const appImportsTemplate = compile(`{{#each imports as |import|}}
import '{{js-string-escape import}}';
{{/each}}`);

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
  // 'addon' an 'app' and we handle them there.
]);

// represents a v2 package
export default class Package {
  static fromV1(addonInstance) : Package {
    return new this(addonInstance);
  }

  private constructor(private addonInstance) {}

  get tree(): Tree {
    let trees = this.v2Trees();
    return new Funnel(mergeTrees(trees), {
      destDir: this.name
    });
  }

  get name() : string {
    return this.addonInstance.pkg.name;
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

  private transpile(tree) {
    // TODO: for Javascript, this should respect the addon's configured babel
    // plugins but only target ES latest, leaving everything else (especially
    // modules) intact. For templates, this should apply custom AST transforms
    // and re-serialize. For styles, this should apply any custom registered
    // style transforms down to plain CSS.
    //
    // All of these steps can be optimized away when we see there is are no
    // special preprocessors registered that wouldn't already be handled by the
    // app-wide final babel and/or template compilation.
    //
    // TODO: also remember to add our own babel plugin that rewrites absolute
    // specifiers within the same package to relative specifiers.
    return tree;
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

  private implicitImportTree() {
    if (!this.addonInstance._trackedImports) {
      return;
    }

    let appImports = [];
    let testImports = [];

    this.addonInstance._trackedImports.forEach(({ assetPath, options }) => {
      let standardAssetPath = standardizeAssetPath(assetPath);
      if (!standardAssetPath) {
        return;
      }
      if (options.type === 'vendor') {
        if (options.outputFile && options.outputFile !== '/assets/vendor.js') {
          todo(`${this.name} is app.importing vendor assets into a nonstandard output file ${options.outputFile}`);
        }
        appImports.push(standardAssetPath);
      } else if (options.type === 'test') {
        testImports.push(standardAssetPath);
      } else {
        todo(`${this.name} has a non-standard app.import type ${options.type} for asset ${assetPath}`);
      }
    });
    if (appImports.length === 0 && testImports.length === 0) {
      return;
    }
    quickTemp.makeOrRemake(this, 'implicitImportDir');
    if (appImports.length > 0) {
      writeFileSync(join(this.implicitImportDir, `_implicit_imports_.js`), appImportsTemplate({ imports: appImports }), 'utf8');
    }
    if (testImports.length > 0) {
      writeFileSync(join(this.implicitImportDir, `_implicit_test_imports_.js`), appImportsTemplate({ imports: testImports }), 'utf8');
    }
    return new UnwatchedDir(this.implicitImportDir);
  }
  private implicitImportDir;

  private parseImports(tree) {
    return new ImportParser(tree);
  }

  private v2Trees() {
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
      // TODO: track all the javascript in here for inclusion in our automatic
      // implicit imports.
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
      // TODO track all the Javascript in here and put it into our implicit
      // automatic imports.
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

function standardizeAssetPath(assetPath) {
  let [first, ...rest] = assetPath.split('/');
  if (first === 'vendor') {
    // our vendor tree is available via relative import
    return './vendor/' + rest.join('/');
  } else if (first === 'node_modules') {
    // our node_modules are allowed to be resolved directly
    return rest.join('/');
  } else {
    todo(`${this.name} app.imported from unknown path ${assetPath}`);
  }
}
