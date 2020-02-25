import V1Package from './v1-package';
import { Memoize } from 'typescript-memoize';
import { dirname } from 'path';
import { sync as pkgUpSync } from 'pkg-up';
import { join } from 'path';
import { existsSync, pathExistsSync } from 'fs-extra';
import Funnel, { Options as FunnelOptions } from 'broccoli-funnel';
import { UnwatchedDir, WatchedDir } from 'broccoli-source';
import RewritePackageJSON from './rewrite-package-json';
import { todo, unsupported } from '@embroider/core/src/messages';
import { Tree } from 'broccoli-plugin';
import mergeTrees from 'broccoli-merge-trees';
import semver from 'semver';
import rewriteAddonTree from './rewrite-addon-tree';
import { mergeWithAppend } from './merges';
import { AddonMeta, TemplateCompiler, debug, PackageCache } from '@embroider/core';
import Options from './options';
import walkSync from 'walk-sync';
import ObserveTree from './observe-tree';
import { Options as HTMLBarsOptions } from 'ember-cli-htmlbars';
import { isEmbroiderMacrosPlugin } from '@embroider/macros';
import { TransformOptions, PluginItem } from '@babel/core';
import V1App from './v1-app';
import modulesCompat from './modules-compat';
import writeFile from 'broccoli-file-creator';
import SynthesizeTemplateOnlyComponents from './synthesize-template-only-components';
import { isEmberAutoImportDynamic } from './detect-ember-auto-import';

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

const dynamicTreeHooks = Object.freeze([
  'treeFor',
  'treeForAddon',
  'treeForAddonTemplates',
  'treeForAddonTestSupport',
  'treeForApp',
  'treeForPublic',
  'treeForStyles',
  'treeForTemplates',
  'treeForTestSupport',
  'treeForVendor',
]);

const appPublicationDir = '_app_';
const fastbootPublicationDir = '_fastboot_';

// This controls and types the interface between our new world and the classic
// v1 addon instance.
export default class V1Addon implements V1Package {
  constructor(
    protected addonInstance: any,
    protected addonOptions: Required<Options>,
    private app: V1App,
    private packageCache: PackageCache
  ) {
    if (addonInstance.registry) {
      this.updateRegistry(addonInstance.registry);
    }
  }

  // this is only defined when there are custom AST transforms that need it
  @Memoize()
  private get templateCompiler(): TemplateCompiler | undefined {
    let htmlbars = this.addonInstance.addons.find((a: any) => a.name === 'ember-cli-htmlbars');
    if (htmlbars) {
      let options = htmlbars.htmlbarsOptions() as HTMLBarsOptions;
      if (options.plugins && options.plugins.ast) {
        // our macros don't run here in stage1
        options.plugins.ast = options.plugins.ast.filter((p: any) => !isEmbroiderMacrosPlugin(p));
        if (options.plugins.ast.length > 0) {
          return new TemplateCompiler({
            compilerPath: options.templateCompilerPath,
            EmberENV: {},
            plugins: options.plugins,
          });
        }
      }
    }
  }

  private updateRegistry(registry: any) {
    // auto-import gets disabled because we support it natively
    registry.remove('js', 'ember-auto-import-analyzer');

    // here we're replacing the stock template compiler with our own. Ours
    // leaves hbs files as hbs, not js. The only transformation it is supposed
    // to do is applying any custom AST transforms and reserializing the results
    // back to HBS.
    //
    // Even when no AST transforms are registered, we'll still need to register
    // a no-op transform here to avoid an exception coming out of ember-cli like
    // "Addon templates were detected, but there are no template compilers
    // registered".
    registry.remove('template', 'ember-cli-htmlbars');
    registry.add('template', {
      name: 'embroider-addon-templates',
      ext: 'hbs',
      _addon: this,
      toTree(this: { _addon: V1Addon }, tree: Tree): Tree {
        if (this._addon.templateCompiler) {
          return this._addon.templateCompiler.applyTransformsToTree(tree);
        } else {
          // when there are no custom AST transforms, we don't need to do
          // anything at all.
          return tree;
        }
      },
    });

    if (this.needsCustomBabel()) {
      // there is customized babel behavior needed, so we will leave
      // ember-cli-babel in place, but modify its config so it doesn't do the
      // things we don't want to do in stage1.
      this.updateBabelConfig();
    } else {
      // no custom babel behavior, so we don't run the ember-cli-babel
      // preprocessor at all. We still need to register a no-op preprocessor to
      // prevent ember-cli from emitting a deprecation warning.
      registry.remove('js', 'ember-cli-babel');
      registry.add('js', {
        name: 'embroider-babel-noop',
        ext: 'js',
        toTree(tree: Tree) {
          return tree;
        },
      });
    }
  }

  // we need to run custom inline hbs preprocessing if there are custom hbs
  // plugins and there are inline hbs templates
  private needsInlineHBS(): boolean {
    if (!this.templateCompiler) {
      // no custom transforms
      return false;
    }
    if (this.addonInstance.addons.find((a: any) => a.name === 'ember-cli-htmlbars-inline-precompile')) {
      // the older inline template compiler is present
      return true;
    }

    if (
      this.addonInstance.addons.find(
        (a: any) =>
          a.name === 'ember-cli-htmlbars' && semver.satisfies(semver.coerce(a.pkg.version) || a.pkg.version, '>4.0.0')
      )
    ) {
      // a version of ember-cli-htmlbars that natively supports inline hbs is present
      return true;
    }

    return false;
  }

  private needsCustomBabel() {
    let babelConfig = this.options.babel as TransformOptions | undefined;
    if (babelConfig && babelConfig.plugins && babelConfig.plugins.length > 0) {
      // this addon has custom babel plugins, so we need to run them here in
      // stage1
      return true;
    }

    // even if there are no custom babel plugins, if we need to do any
    // preprocessing of inline handlebars templates we still need to run the
    // custom babel.
    return this.needsInlineHBS();
  }

  get name(): string {
    return this.packageJSON.name;
  }

  protected get packageJSON() {
    return this.addonInstance.pkg;
  }

  @Memoize()
  get root(): string {
    // addonInstance.root gets modified by a customized "main" or
    // "ember-addon.main" in package.json. We want the real package root here
    // (the place where package.json lives).
    return dirname(pkgUpSync(this.addonInstance.root)!);
  }

  @Memoize()
  private get mainModule() {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require(this.addonInstance.constructor._meta_.modulePath);

    if (typeof mod === 'function') {
      return mod.prototype;
    } else {
      return mod;
    }
  }

  protected get options() {
    if (!this.addonInstance.options) {
      this.addonInstance.options = {};
      return this.addonInstance.options;
    }
    // some addons (like ember-cli-inline-content) assign the *app's* options
    // onto their own this.options. Which means they (accidentally or on
    // purpose), always get the app's babel config, and it means when we try
    // to modify the addon's babel config we're accidentally modifying the
    // app's too.
    //
    // So here we do copying to ensure that we can modify the babel config
    // without altering anybody else. We're not doing cloneDeep because that
    // pulls on our lazy MacrosConfig if it appears in any babel configs here,
    // whereas we want to leave it unevaluated until babel actually uses it.
    let addonOptions =
      typeof this.addonInstance.options == 'function' ? this.addonInstance.options() : this.addonInstance.options;
    let options = Object.assign({}, addonOptions);
    if (options.babel) {
      options.babel = Object.assign({}, options.babel);
      if (options.babel.plugins) {
        options.babel.plugins = options.babel.plugins.slice();
      }
    }
    if (options['ember-cli-babel']) {
      options['ember-cli-babel'] = Object.assign({}, options['ember-cli-babel']);
    }

    if (typeof this.addonInstance.options == 'function') {
      this.addonInstance.options = () => options;
    } else {
      this.addonInstance.options = options;
    }

    return options;
  }

  protected customizes(...treeNames: string[]) {
    return Boolean(treeNames.find(treeName => this.mainModule[treeName]));
  }

  @Memoize()
  private hasStockTree(treeName: string) {
    return this.addonInstance.treePaths && existsSync(join(this.root, this.addonInstance.treePaths[treeName]));
  }

  hasAnyTrees(): boolean {
    return Boolean(stockTreeNames.find(name => this.hasStockTree(name))) || this.customizes(...dynamicTreeHooks);
  }

  // we keep all these here to ensure that we always apply the same options to
  // the same tree, so that our cache doesn't need to worry about varying
  // options.
  private stockTreeFunnelOptions(treeName: string): FunnelOptions | undefined {
    switch (treeName) {
      case 'addon':
        return {
          exclude: ['styles/**'],
        };
      case 'styles':
        return {
          destDir: '_app_styles_',
        };
      case 'addon-test-support':
        return {
          destDir: 'test-support',
        };
      case 'app':
        return {
          exclude: ['styles/**'],
          destDir: appPublicationDir,
        };
      case 'public':
        return {
          destDir: 'public',
        };
      case 'vendor':
        return {
          destDir: 'vendor',
        };
    }
  }

  protected stockTree(treeName: string) {
    return this.throughTreeCache(treeName, 'stock', () => {
      let opts = Object.assign(
        {
          srcDir: this.addonInstance.treePaths[treeName],
        },
        this.stockTreeFunnelOptions(treeName)
      );
      return new Funnel(this.rootTree, opts);
    })!;
  }

  @Memoize()
  private get rootTree() {
    if (this.packageCache.get(this.root).mayRebuild) {
      return new WatchedDir(this.root);
    } else {
      return new UnwatchedDir(this.root);
    }
  }

  @Memoize()
  private get moduleName() {
    if (typeof this.addonInstance.moduleName === 'function') {
      return this.addonInstance.moduleName();
    }
    return this.addonInstance.name;
  }

  // applies preprocessors to JS and HBS
  private transpile(tree: Tree) {
    tree = this.addonInstance.preprocessJs(tree, '/', this.moduleName, {
      registry: this.addonInstance.registry,
    });
    if (this.addonInstance.shouldCompileTemplates() && this.addonInstance.registry.load('template').length > 0) {
      tree = this.app.preprocessRegistry.preprocessTemplates(tree, {
        registry: this.addonInstance.registry,
      });
    }
    return tree;
  }

  @Memoize()
  protected updateBabelConfig() {
    let packageOptions = this.options;
    let emberCLIBabelInstance = this.addonInstance.addons.find((a: any) => a.name === 'ember-cli-babel');
    let version;

    if (emberCLIBabelInstance) {
      version = emberCLIBabelInstance.pkg.version;
    }

    if (!packageOptions['ember-cli-babel']) {
      packageOptions['ember-cli-babel'] = {};
    }

    if (!packageOptions.babel) {
      packageOptions.babel = {};
    }
    let babelConfig = packageOptions.babel as TransformOptions;

    Object.assign(packageOptions['ember-cli-babel'], {
      compileModules: false,
      disablePresetEnv: true,
      disableDebugTooling: true,
      disableEmberModulesAPIPolyfill: true,
    });

    if (version && semver.satisfies(semver.coerce(version) || version, '^5')) {
      unsupported(`${this.name} is using babel 5. Not installing our custom plugin.`);
      return;
    }

    if (!babelConfig.plugins) {
      babelConfig.plugins = [];
    } else {
      let hadAutoImport = Boolean(babelConfig.plugins.find(isEmberAutoImportDynamic));
      babelConfig.plugins = babelConfig.plugins.filter(babelPluginAllowedInStage1);
      if (hadAutoImport) {
        // if we removed ember-auto-import's dynamic import() plugin, the code
        // may use import() syntax and we need to re-add it to the parser.
        if (version && semver.satisfies(semver.coerce(version) || version, '^6')) {
          babelConfig.plugins.push(require.resolve('babel-plugin-syntax-dynamic-import'));
        } else {
          babelConfig.plugins.push(require.resolve('@babel/plugin-syntax-dynamic-import'));
        }
      }
    }

    if (this.templateCompiler) {
      babelConfig.plugins.push(this.templateCompiler.inlineTransformsBabelPlugin());
    }
  }

  get v2Tree(): Tree {
    return this.throughTreeCache('addon', 'v2Tree', () => mergeTrees(this.v2Trees, { overwrite: true }));
  }

  // this is split out so that compatibility shims can override it to add more
  // things to the package metadata.
  protected get packageMeta(): Partial<AddonMeta> {
    let built = this.build();
    return mergeWithAppend({}, built.staticMeta, ...built.dynamicMeta.map(d => d()));
  }

  @Memoize()
  protected get v2Trees() {
    let { trees } = this.build();
    let packageJSONRewriter = new RewritePackageJSON(this.rootTree, () => this.packageMeta);
    trees.push(packageJSONRewriter);
    return trees;
  }

  protected throughTreeCache(name: string, category: string, fn: () => Tree): Tree;
  protected throughTreeCache(name: string, category: string, fn: () => Tree | undefined): Tree | undefined {
    let cacheKey;
    if (typeof this.addonInstance.cacheKeyForTree === 'function') {
      cacheKey = this.addonInstance.cacheKeyForTree(name);
      if (cacheKey) {
        cacheKey = cacheKey + category;
        let cachedTree = this.app.addonTreeCache.get(cacheKey);
        if (cachedTree) {
          debug('cache hit %s %s %s', this.name, name, category);
          return cachedTree;
        }
      }
    }
    debug('cache miss %s %s %s', this.name, name, category);
    let tree = fn();
    if (tree && cacheKey) {
      this.app.addonTreeCache.set(cacheKey, tree);
    }
    return tree;
  }

  protected invokeOriginalTreeFor(
    name: string,
    { neuterPreprocessors } = { neuterPreprocessors: false }
  ): Tree | undefined {
    return this.throughTreeCache(name, 'original', () => {
      let original;
      try {
        if (neuterPreprocessors) {
          original = this.addonInstance.preprocessJs;
          this.addonInstance.preprocessJs = function(tree: Tree) {
            return tree;
          };
        }
        return this.addonInstance._treeFor(name);
      } finally {
        if (neuterPreprocessors) {
          this.addonInstance.preprocessJs = original;
        }
      }
    });
  }

  protected treeForAddon(built: IntermediateBuild): Tree | undefined {
    if (this.customizes('treeForAddon', 'treeForAddonTemplates')) {
      let tree = this.invokeOriginalTreeFor('addon', { neuterPreprocessors: true });
      if (tree) {
        tree = modulesCompat(tree);

        // this captures addons that are trying to escape their own package's
        // namespace
        let result = rewriteAddonTree(tree, this.name, this.moduleName);
        tree = result.tree;
        built.dynamicMeta.push(result.getMeta);

        return this.transpile(tree);
      }
    } else if (this.hasStockTree('addon')) {
      return this.transpile(this.stockTree('addon'));
    }
  }

  protected addonStylesTree(): Tree | undefined {
    if (this.customizes('treeForAddonStyles')) {
      todo(`${this.name} may have customized the addon style tree`);
    } else if (this.hasStockTree('addon-styles')) {
      return this.addonInstance.compileStyles(this.stockTree('addon-styles'));
    }
  }

  protected treeForTestSupport(): Tree | undefined {
    if (this.customizes('treeForTestSupport')) {
      todo(`${this.name} has customized the test support tree`);
    } else if (this.hasStockTree('test-support')) {
      // this one doesn't go through transpile yet because it gets handled as
      // part of the consuming app. For example, imports should be relative to
      // the consuming app, not our own package.
      return new Funnel(this.stockTree('test-support'), {
        destDir: `${appPublicationDir}/tests`,
      });
    }
  }

  private buildTreeForAddon(built: IntermediateBuild) {
    let tree = this.treeForAddon(built);
    if (!tree) {
      return;
    }
    let templateOnlyComponents: Tree = new SynthesizeTemplateOnlyComponents(tree, ['components']);
    if (!this.addonOptions.staticAddonTrees) {
      let filenames: string[] = [];
      let templateOnlyComponentNames: string[] = [];

      tree = new ObserveTree(tree, outputDir => {
        filenames = walkSync(outputDir, { globs: ['**/*.js', '**/*.hbs'] })
          .map(f => `./${f.replace(/\.js$/i, '')}`)
          .filter(notColocatedTemplate);
      });

      templateOnlyComponents = new ObserveTree(templateOnlyComponents, outputDir => {
        templateOnlyComponentNames = walkSync(outputDir, { globs: ['**/*.js'] }).map(
          f => `./${f.replace(/\.js$/i, '')}`
        );
      });

      built.dynamicMeta.push(() => ({
        'implicit-modules': filenames.concat(templateOnlyComponentNames),
      }));
    }
    built.trees.push(tree);
    built.trees.push(templateOnlyComponents);
  }

  private buildAddonStyles(built: IntermediateBuild) {
    let addonStylesTree = this.addonStylesTree();
    if (addonStylesTree) {
      let discoveredFiles: string[] = [];
      let tree = new ObserveTree(addonStylesTree, outputPath => {
        discoveredFiles = walkSync(outputPath, { globs: ['**/*.css'], directories: false });
      });
      built.trees.push(tree);
      built.dynamicMeta.push(() => {
        return {
          'implicit-styles': discoveredFiles.map(f => `./${f}`),
        };
      });
    }
  }

  private buildTreeForStyles(built: IntermediateBuild) {
    let tree;
    if (this.customizes('treeForStyles')) {
      // the user's tree returns their own styles with no "app/styles" wrapping
      // around, which is actually what we want
      tree = this.invokeOriginalTreeFor('styles');
      if (tree) {
        tree = new Funnel(tree, {
          destDir: '_app_styles_',
          getDestinationPath(path) {
            return path.replace(/^app\/styles\//, '');
          },
        });
      }
    } else if (this.hasStockTree('styles')) {
      tree = this.stockTree('styles');
    }
    if (tree) {
      built.trees.push(tree);
    }
  }

  private buildAddonTestSupport(built: IntermediateBuild) {
    let addonTestSupportTree;
    if (this.customizes('treeForAddonTestSupport')) {
      let original = this.invokeOriginalTreeFor('addon-test-support', { neuterPreprocessors: true });
      if (original) {
        let { tree, getMeta } = rewriteAddonTree(original, this.name, this.moduleName);
        addonTestSupportTree = this.transpile(tree);
        built.dynamicMeta.push(getMeta);
      }
    } else if (this.hasStockTree('addon-test-support')) {
      addonTestSupportTree = this.transpile(this.stockTree('addon-test-support'));
    }
    if (addonTestSupportTree) {
      if (!this.addonOptions.staticAddonTestSupportTrees) {
        let filenames: string[] = [];
        addonTestSupportTree = new ObserveTree(addonTestSupportTree, outputPath => {
          filenames = walkSync(outputPath, { globs: ['**/*.js', '**/*.hbs'] }).map(f => `./${f.replace(/.js$/i, '')}`);
        });
        built.dynamicMeta.push(() => ({
          'implicit-test-modules': filenames,
        }));
      }
      built.trees.push(addonTestSupportTree);
    }
  }

  private maybeSetDirectoryMeta(built: IntermediateBuild, tree: Tree, localDir: string, key: keyof AddonMeta): Tree {
    // unforunately Funnel doesn't create destDir if its input exists but is
    // empty. And we want to only put the app-js key in package.json if
    // there's really a directory for it to point to. So we need to monitor
    // the output and use dynamicMeta.
    let dirExists = false;
    built.dynamicMeta.push(() => {
      if (dirExists) {
        return { [key]: localDir };
      } else {
        return {};
      }
    });
    return new ObserveTree(tree, (outputPath: string) => {
      dirExists = pathExistsSync(join(outputPath, localDir));
    });
  }

  private buildTestSupport(built: IntermediateBuild) {
    let tree = this.treeForTestSupport();
    if (tree) {
      tree = this.maybeSetDirectoryMeta(built, tree, appPublicationDir, 'app-js');
      built.trees.push(tree);
    }
  }

  private buildTreeForApp(built: IntermediateBuild) {
    let appTree;
    if (this.customizes('treeForApp', 'treeForTemplates')) {
      let original = this.invokeOriginalTreeFor('app');
      if (original) {
        appTree = new Funnel(original, {
          destDir: appPublicationDir,
        });
      }
    } else if (this.hasStockTree('app')) {
      appTree = this.stockTree('app');
    }

    if (appTree) {
      // this one doesn't go through transpile yet because it gets handled as
      // part of the consuming app.
      appTree = this.maybeSetDirectoryMeta(built, appTree, appPublicationDir, 'app-js');
      built.trees.push(appTree);
    }

    if (
      typeof this.addonInstance.isDevelopingAddon === 'function' &&
      this.addonInstance.isDevelopingAddon() &&
      this.addonInstance.hintingEnabled()
    ) {
      let hintTree = this.addonInstance.jshintAddonTree();
      if (hintTree) {
        hintTree = this.maybeSetDirectoryMeta(
          built,
          new Funnel(hintTree, { destDir: appPublicationDir }),
          appPublicationDir,
          'app-js'
        );
        built.trees.push(hintTree);
      }
    }
  }

  private buildTreeForFastBoot(built: IntermediateBuild) {
    let tree;

    if (this.customizes('treeForFastBoot')) {
      // Arguably, it would be more correct to always create the new Funnel,
      // because the fastboot directory could be created *after* our build starts.
      // But that would result in hundreds of additional trees, even though the
      // vast majority of addons aren't changing and don't have fastboot
      // directories. So I'm pretty comfortable with the optimization. It means
      // that an addon author who creates a brand new fastboot directory in a v1
      // packages will need to restart their build. (Really we hope new addons
      // will be authored in v2 instead soon anyway, and they won't need the
      // concept of "fastboot directory" because they can use the macro system to
      // conditionally import some things only in fastboot.)
      if (pathExistsSync(join(this.root, 'fastboot'))) {
        tree = new Funnel(this.rootTree, { srcDir: 'fastboot' });
      }
      tree = this.addonInstance.treeForFastBoot(tree);
      tree = new Funnel(tree, { destDir: fastbootPublicationDir });
    } else {
      if (pathExistsSync(join(this.root, 'fastboot'))) {
        tree = new Funnel(this.rootTree, { srcDir: 'fastboot', destDir: fastbootPublicationDir });
      }
    }

    if (tree) {
      // this one doesn't go through transpile yet because it gets handled as
      // part of the consuming app.
      tree = this.maybeSetDirectoryMeta(built, tree, fastbootPublicationDir, 'fastboot-js');
      built.trees.push(tree);
    }
  }

  private buildPublicTree(built: IntermediateBuild) {
    let publicTree;
    if (this.customizes('treeForPublic')) {
      let original = this.invokeOriginalTreeFor('public');
      if (original) {
        publicTree = new Funnel(original, {
          destDir: 'public',
        });
      }
    } else if (this.hasStockTree('public')) {
      publicTree = this.stockTree('public');
    }
    if (publicTree) {
      let publicAssets: { [filename: string]: string } = {};
      publicTree = new ObserveTree(publicTree, (outputPath: string) => {
        publicAssets = {};
        for (let filename of walkSync(join(outputPath, 'public'))) {
          if (!filename.endsWith('/')) {
            publicAssets[`public/${filename}`] = filename;
          }
        }
      });
      built.trees.push(publicTree);
      built.dynamicMeta.push(() => ({ 'public-assets': publicAssets }));
    }
  }

  private buildVendorTree(built: IntermediateBuild) {
    if (this.customizes('treeForVendor')) {
      // We don't have any particular opinions about the structure inside
      // vendor, so even when it's customized we can just use the customized
      // one.
      let tree = this.invokeOriginalTreeFor('vendor');
      if (tree) {
        built.trees.push(
          new Funnel(tree, {
            destDir: 'vendor',
          })
        );
      }
    } else if (this.hasStockTree('vendor')) {
      built.trees.push(this.stockTree('vendor'));
    }
  }

  private buildEngineConfig(built: IntermediateBuild) {
    if (typeof this.addonInstance.getEngineConfigContents !== 'function') {
      return;
    }

    // this addon is an engine, so it needs its own config/environment.js
    let configTree = writeFile('config/environment.js', this.addonInstance.getEngineConfigContents());
    built.trees.push(configTree);
  }

  @Memoize()
  private build(): IntermediateBuild {
    let built = new IntermediateBuild();

    if (this.moduleName !== this.name) {
      built.staticMeta['renamed-packages'] = {
        [this.moduleName]: this.name,
      };
    }

    if (this.customizes('treeFor')) {
      unsupported(`${this.name} has customized treeFor`);
    }

    this.buildTreeForAddon(built);
    this.buildAddonStyles(built);
    this.buildTreeForStyles(built);
    this.buildAddonTestSupport(built);
    this.buildTestSupport(built);
    this.buildTreeForApp(built);
    this.buildTreeForFastBoot(built);
    this.buildPublicTree(built);
    this.buildVendorTree(built);
    this.buildEngineConfig(built);

    return built;
  }
}

export interface V1AddonConstructor {
  new (addonInstance: any, options: Required<Options>, app: V1App, packageCache: PackageCache): V1Addon;
}

class IntermediateBuild {
  trees: Tree[] = [];
  staticMeta: { [metaField: string]: any } = {};
  dynamicMeta: (() => Partial<AddonMeta>)[] = [];
}

function babelPluginAllowedInStage1(plugin: PluginItem) {
  if (isEmbroiderMacrosPlugin(plugin)) {
    // the point of @embroider/macros is that it's allowed to stay in v2
    // addon publication format, so it doesn't need to run here in stage1.
    // We always run it in stage3.
    return false;
  }

  if (TemplateCompiler.isInlinePrecompilePlugin(plugin)) {
    // Similarly, the inline precompile plugin must not run in stage1. We
    // want all templates uncompiled. Instead, we will be adding our own
    // plugin that only runs custom AST transforms inside inline
    // templates.
    return false;
  }

  if (isEmberAutoImportDynamic(plugin)) {
    // We replace ember-auto-import's implementation of dynamic import(), so we
    // need to stop its plugin from rewriting those.
    return false;
  }

  return true;
}

function notColocatedTemplate(path: string) {
  return !/^\.\/components\/.*\.hbs$/.test(path);
}
