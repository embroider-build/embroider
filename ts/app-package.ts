import Package from './package';
import { Memoize } from 'typescript-memoize';
import { dirname } from 'path';
import { sync as pkgUpSync }  from 'pkg-up';
import makeDebug from 'debug';
import { WatchedDir } from 'broccoli-source';
import DependencyAnalyzer from './dependency-analyzer';
import RewritePackageJSON from './rewrite-package-json';
import { join } from 'path';
import resolve from 'resolve';
import Funnel from 'broccoli-funnel';
import mergeTrees from 'broccoli-merge-trees';

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

    trees.push(this.htmlTree);

    todo('more trees: src, tests, styles, templates, bower, vendor, public');

    let analyzer = new DependencyAnalyzer(importParsers, this.app.project.pkg, true );
    trees.push(new RewritePackageJSON(this.rootTree, analyzer));

    return trees;
  }

  @Memoize()
  private get isModuleUnification() {
    let experiments = this.requireFromEmberCLI('./lib/experiments');
    return experiments.MODULE_UNIFICATION && !!this.app.trees.src;
  }

  @Memoize()
  private get emberCLILocation() {
    return dirname(resolve.sync('ember-cli/package.json', { basedir: this.root }));
  }

  private requireFromEmberCLI(specifier) {
    return require(resolve.sync(specifier, { basedir: this.emberCLILocation }));
  }

  @Memoize()
  private get configReplace() {
    return this.requireFromEmberCLI('broccoli-config-replace');
  }

  @Memoize()
  private get configLoader() {
    return this.requireFromEmberCLI('broccoli-config-loader');
  }

  @Memoize()
  private get appUtils() {
    return this.requireFromEmberCLI('./lib/utilities/ember-app-utils');
  }

  @Memoize()
  private get configTree() {
    return new (this.configLoader)(dirname(this.app.project.configPath()), {
      env: this.app.env,
      tests: this.app.tests || false,
      project: this.app.project,
    });
  }

  @Memoize()
  private get htmlTree() {
    let indexFilePath = this.options.outputPaths.app.html;

    let index = new Funnel(this.rootTree, {
      allowEmtpy: true,
      include: [`app/index.html`],
      getDestinationPath: () => indexFilePath,
      annotation: 'app/index.html',
    });

    if (this.isModuleUnification) {
      let srcIndex = new Funnel(this.rootTree, {
        files: ['src/ui/index.html'],
        getDestinationPath: () => indexFilePath,
        annotation: 'src/ui/index.html',
      });

      index = mergeTrees([
        index,
        srcIndex,
      ], {
        overwrite: true,
        annotation: 'merge classic and MU index.html'
      });
    }

    let patterns = this.appUtils.configReplacePatterns({
      addons: this.app.project.addons,
      autoRun: this.options.autoRun,
      storeConfigInMeta: this.options.storeConfigInMeta,
      isModuleUnification: this.isModuleUnification
    });

    return new (this.configReplace)(index, this.configTree, {
      configPath: join('environments', `${this.app.env}.json`),
      files: [indexFilePath],
      patterns,
    });
  }

  @Memoize()
  private get root(): string {
    return dirname(pkgUpSync(this.app.root));
  }

  @Memoize()
  private get rootTree() {
    return new WatchedDir(this.root);
  }

  protected get trackedImports() {
    return this.app._trackedImports;
  }

  protected preprocessJS(tree) {
    return this.preprocessors.preprocessJs(tree, '/', '/', { registry: this.app.registry });
  }
}
