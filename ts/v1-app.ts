import { Memoize } from 'typescript-memoize';
import { dirname } from 'path';
import { sync as pkgUpSync }  from 'pkg-up';
import { join } from 'path';
import Funnel from 'broccoli-funnel';
import mergeTrees from 'broccoli-merge-trees';
import { WatchedDir } from 'broccoli-source';
import resolve from 'resolve';
import { updateBabelConfig } from './babel-config';
import DependencyAnalyzer from './dependency-analyzer';
import RewritePackageJSON from './rewrite-package-json';
import { todo } from './messages';
import { trackedImportTree } from './tracked-imports';
import quickTemp from 'quick-temp';
import ImportParser from './import-parser';
import V1Package from './v1-package';
import { Tree } from 'broccoli-plugin';

// This controls and types the interface between our new world and the classic
// v1 app instance.
export default class V1App implements V1Package {
  constructor(private app) {
  }

  // always the name from package.json. Not the one that apps may have weirdly
  // customized.
  get name() : string {
    return this.app.project.pkg.name;
  }

  @Memoize()
  get root(): string {
    return dirname(pkgUpSync(this.app.root));
  }

  @Memoize()
  private get rootTree() {
    return new WatchedDir(this.root);
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

  @Memoize()
  private get preprocessors() {
    return this.requireFromEmberCLI('ember-cli-preprocess-registry/preprocessors');
  }

  private get configTree() {
    return new (this.configLoader)(dirname(this.app.project.configPath()), {
      env: this.app.env,
      tests: this.app.tests || false,
      project: this.app.project,
    });
  }

  private get htmlTree() {
    let indexFilePath = this.app.options.outputPaths.app.html;

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
      autoRun: this.app.options.autoRun,
      storeConfigInMeta: this.app.options.storeConfigInMeta,
      isModuleUnification: this.isModuleUnification
    });

    return new (this.configReplace)(index, this.configTree, {
      configPath: join('environments', `${this.app.env}.json`),
      files: [indexFilePath],
      patterns,
    });
  }

  private transpile(tree) {
    this.updateBabelConfig();
    return this.preprocessors.preprocessJs(tree, '/', '/', { registry: this.app.registry });
  }

  @Memoize()
  private updateBabelConfig() {
    updateBabelConfig(this.name, this.app.options, this.app.project.addons.find(a => a.name === 'ember-cli-babel'));
  }

  get appTree(): Tree {
    this.makeV2Trees();
    return this.appTreePriv;
  }

  get v2Trees() : Tree[] {
    return this.makeV2Trees();
  }

  private appTreePriv;

  @Memoize()
  private makeV2Trees() {
    let inputTrees = this.app.trees;
    let trees = [];
    let importParsers = [];

    {
      quickTemp.makeOrRemake(this, 'trackedImportDir');
      let tree = trackedImportTree(this.name, this.app._trackedImports, (this as any).trackedImportDir);
      if (tree) {
        trees.push(tree);
      }
    }
    if (inputTrees.app) {
      let appTree = this.transpile(inputTrees.app);
      importParsers.push(this.parseImports(appTree));
      trees.push(appTree);
      this.appTreePriv = appTree;
    }

    trees.push(this.htmlTree);

    todo('more trees: src, tests, styles, templates, bower, vendor, public');

    let analyzer = new DependencyAnalyzer(importParsers, this.app.project.pkg, true );
    trees.push(new RewritePackageJSON(this.rootTree, analyzer));

    return trees;
  }

  private parseImports(tree) {
    return new ImportParser(tree);
  }
}
