import { Memoize } from 'typescript-memoize';
import { dirname } from 'path';
import { sync as pkgUpSync }  from 'pkg-up';
import { join } from 'path';
import Funnel from 'broccoli-funnel';
import mergeTrees from 'broccoli-merge-trees';
import { WatchedDir } from 'broccoli-source';
import resolve from 'resolve';
import { TrackedImport } from './tracked-imports';
import V1Package from './v1-package';
import { Tree } from 'broccoli-plugin';
import DependencyAnalyzer from './dependency-analyzer';
import ImportParser from './import-parser';
import get from 'lodash/get';
import { V1Config, WriteV1Config } from './v1-config';
import { PackageCache, TemplateCompilerPlugins } from '@embroider/core';
import { todo } from './messages';
import { synthesize } from './parallel-babel-shim';

// This controls and types the interface between our new world and the classic
// v1 app instance.
export default class V1App implements V1Package {
  constructor(private app: any, private packageCache: PackageCache) {
  }

  // always the name from package.json. Not the one that apps may have weirdly
  // customized.
  get name() : string {
    return this.app.project.pkg.name;
  }

  get env(): string {
    return this.app.env;
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
  get isModuleUnification() {
    let experiments = this.requireFromEmberCLI('./lib/experiments');
    return experiments.MODULE_UNIFICATION && !!this.app.trees.src;
  }

  @Memoize()
  private get emberCLILocation() {
    return dirname(resolve.sync('ember-cli/package.json', { basedir: this.root }));
  }

  private requireFromEmberCLI(specifier: string) {
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

  @Memoize()
  get config(): V1Config {
    return new V1Config(this.configTree, this.app.env);
  }

  get autoRun(): boolean {
    return this.app.options.autoRun;
  }

  private get storeConfigInMeta(): boolean {
    return this.app.options.storeConfigInMeta;
  }

  get htmlTree() {
    return mergeTrees([this.indexTree, this.app.testIndex()]);
  }

  get indexTree() {
    let indexFilePath = this.app.options.outputPaths.app.html;

    let index: Tree = new Funnel(this.rootTree, {
      allowEmpty: true,
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
      autoRun: this.autoRun,
      storeConfigInMeta: this.storeConfigInMeta,
      isModuleUnification: this.isModuleUnification
    });

    return new (this.configReplace)(index, this.configTree, {
      configPath: join('environments', `${this.app.env}.json`),
      files: [indexFilePath],
      patterns,
    });
  }

  babelConfig(finalRoot: string, rename: any) {
    let syntheticPlugins = new Map();

    let plugins = get(this.app.options, 'babel.plugins') as any[];
    if (!plugins) {
      plugins = [];
    }

    plugins = plugins.map(plugin => {
      // We want to resolve (not require) the app's configured plugins relative
      // to the app. We want to keep everything serializable.

      // bare string plugin name
      if (typeof plugin === 'string') {
        return resolve.sync(`babel-plugin-${plugin}`, { basedir: finalRoot });
      }

      // pair of [pluginName, pluginOptions]
      if (typeof plugin[0] === 'string') {
        return [resolve.sync(`babel-plugin-${plugin[0]}`, { basedir: finalRoot }), plugin[1]];
      }

      // broccoli-babel-transpiler's custom parallel API. Here we synthesize
      // normal babel plugins that wrap their configuration.
      if (plugin._parallelBabel) {
        let name = `_synthetic_babel_plugin_${syntheticPlugins.size}_.js`;
        syntheticPlugins.set(name, synthesize(plugin._parallelBabel));
        return name;
      }

      todo(`Found a babel plugin that we couldn't deal with`);
    }).filter(Boolean);

    // this is our own plugin that patches up issues like non-explicit hbs
    // extensions and packages importing their own names.
    plugins.push([require.resolve('./babel-plugin'), {
      ownName: this.name,
      basedir: finalRoot,
      rename
    } ]);

    // this is reproducing what ember-cli-babel does. It would be nicer to just
    // call it, but it require()s all the plugins up front, so not serializable.
    // In its case, it's mostly doing it to set basedir so that broccoli caching
    // will be happy, but that's irrelevant to us here.
    plugins.push(this.debugMacrosPlugin());
    let babelInstance = (this.app.project.addons as any[]).find(a => a.name === 'ember-cli-babel');
    if (babelInstance._emberVersionRequiresModulesAPIPolyfill()) {
      let ModulesAPIPolyfill = require.resolve('babel-plugin-ember-modules-api-polyfill');
      let blacklist = babelInstance._getEmberModulesAPIBlacklist();
      plugins.push([ModulesAPIPolyfill, { blacklist }]);
    }

    let config = {
      moduleIds: true,
      babelrc: false,
      plugins,
      presets: [
        [resolve.sync("babel-preset-env", { basedir: this.root }), { targets: babelInstance._getTargets() }]
      ]
    };
    return { config, syntheticPlugins };
  }

  private debugMacrosPlugin() {
    let DebugMacros = require.resolve('babel-plugin-debug-macros');
    let isProduction = process.env.EMBER_ENV === 'production';
    let options = {
      envFlags: {
        source: '@glimmer/env',
        flags: { DEBUG: !isProduction, CI: !!process.env.CI }
      },

      externalizeHelpers: {
        global: 'Ember'
      },

      debugTools: {
        source: '@ember/debug',
        assertPredicateIndex: 1
      }
    };
    return [DebugMacros, options];
  }

  get trackedImports(): TrackedImport[] {
    return this.app._trackedImports;
  }

  private preprocessJS(tree: Tree): Tree {
    // we're saving all our babel compilation for the final stage packager
    this.app.registry.remove('js', 'ember-cli-babel');

    // auto-import is supported natively so we don't need it here
    this.app.registry.remove('js', 'ember-auto-import-analyzer');

    return this.preprocessors.preprocessJs(
      tree, `/`, '/', {
        annotation: 'v1-app-preprocess-js',
        registry: this.app.registry
      }
    );
  }

  get htmlbarsPlugins(): TemplateCompilerPlugins {
    let addon = this.app.project.addons.find((a: any) => a.name === 'ember-cli-htmlbars');
    let options = addon.htmlbarsOptions();
    return options.plugins;
  }

  // our own appTree. Not to be confused with the one that combines the app js
  // from all addons too.
  private get appTree(): Tree {
    return this.preprocessJS(new Funnel(this.app.trees.app, {
      exclude: ['styles/**', "*.html"],
    }));
  }

  private get testsTree(): Tree {
    return this.preprocessJS(new Funnel(this.app.trees.tests, {
      destDir: 'tests'
    }));
  }

  @Memoize()
  private get preprocessors(): Preprocessors {
    return this.requireFromEmberCLI('ember-cli-preprocess-registry/preprocessors');
  }

  private get styleTree(): Tree {
    let options = {
       // we're deliberately not allowing this to be customized. It's an
       // internal implementation detail, and respecting outputPaths here is
       // unnecessary complexity. The corresponding code that adjusts the HTML
       // <link> is in updateHTML in app.ts.
      outputPaths: { app: `/assets/${this.name}.css` },
      registry: this.app.registry,
      minifyCSS: this.app.options.minifyCSS.options,
    };

    return this.preprocessors.preprocessCss(
      this.app.trees.styles,
      `.`,
      '/assets',
      options
    );
  }

  get publicTree(): Tree {
    return this.app.trees.public;
  }

  processAppJS() : { appJS: Tree, analyzer: DependencyAnalyzer } {
    let appTree = this.appTree;
    let testsTree = this.testsTree;
    let analyzer = new DependencyAnalyzer([
      new ImportParser(appTree),
      new ImportParser(testsTree)
    ], this.packageCache.getApp(this.root));
    let config = new WriteV1Config(
      this.config,
      this.storeConfigInMeta,
      this.name
    );
    let trees = [appTree, this.styleTree, config, testsTree];
    return {
      appJS: mergeTrees(trees, { overwrite: true }),
      analyzer
    };
  }

  findAppScript(scripts: HTMLScriptElement[]): HTMLScriptElement | undefined {
    return scripts.find(script => script.src === this.app.options.outputPaths.app.js);
  }

  findAppStyles(styles: HTMLLinkElement[]): HTMLLinkElement | undefined {
    return styles.find(style => style.href === this.app.options.outputPaths.app.css.app);
  }

  findVendorScript(scripts: HTMLScriptElement[]): HTMLScriptElement | undefined {
    return scripts.find(script => script.src === this.app.options.outputPaths.vendor.js);
  }

  findVendorStyles(styles: HTMLLinkElement[]): HTMLLinkElement | undefined {
    return styles.find(style => style.href === this.app.options.outputPaths.vendor.css);
  }

  findTestSupportStyles(styles: HTMLLinkElement[]): HTMLLinkElement | undefined {
    return styles.find(style => style.href === this.app.options.outputPaths.testSupport.css);
  }

  findTestSupportScript(scripts: HTMLScriptElement[]): HTMLScriptElement | undefined {
    return scripts.find(script => script.src === this.app.options.outputPaths.testSupport.js.testSupport);
  }

  findTestScript(scripts: HTMLScriptElement[]): HTMLScriptElement | undefined {
    return scripts.find(script => script.src === this.app.options.outputPaths.tests.js);
  }
}

interface Preprocessors {
  preprocessJs(tree: Tree, a: string, b: string, options: object): Tree;
  preprocessCss(tree: Tree, a: string, b: string, options: object): Tree;
}

