import { Memoize } from 'typescript-memoize';
import { dirname } from 'path';
import { sync as pkgUpSync }  from 'pkg-up';
import { join } from 'path';
import Funnel from 'broccoli-funnel';
import mergeTrees from 'broccoli-merge-trees';
import { WatchedDir } from 'broccoli-source';
import resolve from 'resolve';
import { updateBabelConfig } from './babel-config';
import { todo } from './messages';
import { TrackedImport } from './tracked-imports';
import V1Package from './v1-package';
import { Tree } from 'broccoli-plugin';
import DependencyAnalyzer from './dependency-analyzer';
import ImportParser from './import-parser';

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

  get htmlTree() {
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
    // auto-import gets disabled because we support it natively
    this.app.registry.remove('js', 'ember-auto-import-analyzer');
    updateBabelConfig(this.name, this.app.options, this.app.project.addons.find(a => a.name === 'ember-cli-babel'));
  }

  get trackedImports(): TrackedImport[] {
    return this.app._trackedImports;
  }

  // our own appTree. Not to be confused with the one that combines the app js
  // from all addons too.
  private get appTree() : Tree {
    todo('more trees: src, tests, styles, templates, bower, vendor, public');
    return new Funnel(this.app.trees.app, {
      exclude: ['styles/**', "*.html"],
    });
  }

  // this takes the app JS trees from all active addons, since we can't really
  // build our own code without them due to the way addon-provided "app js"
  // works.
  processAppJS(fromAddons: Tree[], packageJSON) : { appJS: Tree, analyzer: DependencyAnalyzer } {
    let appTree = this.appTree;
    let analyzer = new DependencyAnalyzer([new ImportParser(appTree)], packageJSON, true);

    let trees = [...fromAddons, appTree];
    return {
      appJS: this.transpile(mergeTrees(trees, { overwrite: true })),
      analyzer
    };
  }

  findAppScript(scripts: HTMLScriptElement[]): HTMLScriptElement {
    return scripts.find(script => script.src === this.app.options.outputPaths.app.js);
  }

  findVendorScript(scripts: HTMLScriptElement[]): HTMLScriptElement {
    return scripts.find(script => script.src === this.app.options.outputPaths.vendor.js);
  }
}
