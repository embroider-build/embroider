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
import AppEntrypoint from './app-entrypoint';
import Packages from './packages';

const todo = makeDebug('ember-cli-vanilla:todo');

export default class AppPackage extends Package {

  private app;
  private preprocessors;
  private packages: Packages;

  constructor(app, preprocessors) {
    // TODO: we need to follow all deps, not just active ones. You can still
    // directly import things out of non-active packages, because we follow
    // node_modules resolution rules and those rules don't care about our notion
    // of active.
    let packages = new Packages();
    app.project.addons.forEach(addonInstance => packages.addPackage(addonInstance));
    super();
    this.app = app;
    this.preprocessors = preprocessors;
    this.packages = packages;
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
    let appTree;

    {
      let tree = this.implicitImportTree();
      if (tree) {
        trees.push(tree);
      }
    }
    if (inputTrees.app) {
      appTree = this.transpile(inputTrees.app);
      importParsers.push(this.parseImports(appTree));
      trees.push(appTree);
    }

    trees.push(this.htmlTree);
    trees.push(new AppEntrypoint(appTree, { appPackage: this, outputPath: `assets/${this.name}.js` }));

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

  private get configReplace() {
    return this.requireFromEmberCLI('broccoli-config-replace');
  }

  private get configLoader() {
    return this.requireFromEmberCLI('broccoli-config-loader');
  }

  private get appUtils() {
    return this.requireFromEmberCLI('./lib/utilities/ember-app-utils');
  }

  private get configTree() {
    return new (this.configLoader)(dirname(this.app.project.configPath()), {
      env: this.app.env,
      tests: this.app.tests || false,
      project: this.app.project,
    });
  }

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

  // TODO: This is a placeholder for development purposes only.
  dumpTrees() {
    return [this, ...this.packages.addons.values()].map((pkg, index) => new Funnel(pkg.tree, { destDir: `out-${index}` }));
  }
}
