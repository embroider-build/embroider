import Package from './package';
import { Memoize } from 'typescript-memoize';
import { dirname } from 'path';
import { sync as pkgUpSync }  from 'pkg-up';
import makeDebug from 'debug';
import { UnwatchedDir } from 'broccoli-source';
import DependencyAnalyzer from './dependency-analyzer';
import RewritePackageJSON from './rewrite-package-json';

const todo = makeDebug('ember-cli-vanilla:todo');

export default class AppPackage extends Package {
  constructor(private app, private preprocessors) {
    super();
  }

  get name() : string {
    return this.app.project.pkg.name;
  }

  get directAddons() {
    return this.app.project.addons;
  }

  protected get options() {
    return this.app.options;
  }

  hasAnyTrees() {
    return true;
  }

  protected v2Trees() {
    let inputTrees = this.app.trees;
    let trees = [];
    let importParsers = [];
    {
      let tree = this.implicitImportTree();
      if (tree) {
        trees.push(tree);
      }
    }
    if (inputTrees.app) {
      let tree = this.transpile(inputTrees.app);
      importParsers.push(this.parseImports(tree));
      trees.push(tree);
    }

    todo('more trees: src, tests, styles, templates, bower, vendor, public');

    let analyzer = new DependencyAnalyzer(importParsers, this.app.project.pkg, true );
    trees.push(new RewritePackageJSON(this.rootTree, analyzer));

    return trees;
  }

  @Memoize()
  private get root(): string {
    return dirname(pkgUpSync(this.app.root));
  }

  @Memoize()
  private get rootTree() {
    return new UnwatchedDir(this.root);
  }

  protected get trackedImports() {
    return this.app._trackedImports;
  }

  protected preprocessJS(tree) {
    return this.preprocessors.preprocessJs(tree, '/', '/', { registry: this.app.registry });
  }
}
